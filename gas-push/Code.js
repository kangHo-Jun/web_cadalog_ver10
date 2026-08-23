/**
 * p7_gas.js — 이카운트 ↔ 카페24 가격 자동 동기화 (Google Apps Script)
 * ================================================================
 * v3.0 타겟 동기화 (Targeted Sync)
 *
 * ■ 핵심 전략 (실행시간 대폭 단축)
 *   - [매핑테이블] 시트를 가격 캐시로 활용
 *   - 이카운트 가격과 매핑테이블 비교 → 변동 항목만 추출
 *   - 변동 항목의 product_no + variant_code로 직접 PUT 호출
 *   - 카페24 전체 상품 조회 후 시트 저장 → 변동 건수만큼만 API 호출
 *
 * ■ 초기 실행
 *   - 전체 상품 조회 결과를 매핑테이블/캐시에 반영
 *
 * ■ 시트 구조
 *   [설정]       A: 키, B: 값
 *   [매핑테이블] A: custom_variant_code | B: product_no | C: variant_code | D: ecount_price_vat | E: 최근업데이트 | F: 결과
 *   [실행로그]   A: 실행시각 | B: 실행출처 | C: 업데이트 | D: 스킵 | E: 오류 | F: 상세
 */

// ════════════════════════════════════════════════════════
// ■ 상수
// ════════════════════════════════════════════════════════

const SPREADSHEET_ID = '1_T_pl2ItqfmdAsDmrjkg1BBZyQMAVXkUrPMEwhGI6ek';

const KEY = {
    EC_COM_CODE: 'COM_CODE',
    EC_USER_ID: 'USER_ID',
    EC_CERT_KEY: 'API_CERT_KEY',
    EC_ZONE: 'ZONE',
    EC_ZONE_URL: 'ECOUNT_ZONE_URL',
    EC_PRICE_FIELD: 'ECOUNT_PRICE_FIELD',
    C24_MALL_ID: 'CAFE24_MALL_ID',
    C24_CLIENT_ID: 'CAFE24_CLIENT_ID',
    C24_CLIENT_SECRET: 'CAFE24_CLIENT_SECRET',
    C24_ACCESS_TOKEN: 'CAFE24_ACCESS_TOKEN',
    C24_REFRESH_TOKEN: 'CAFE24_REFRESH_TOKEN',
    C24_API_VERSION: 'CAFE24_API_VERSION',
    DRY_RUN: 'DRY_RUN',
    DEBUG_PRODUCT_NO: 'DEBUG_PRODUCT_NO',
    ADMIN_EMAIL: 'ADMIN_EMAIL',
    TOKEN_EXPIRES_AT: 'TOKEN_EXPIRES_AT',
    REFRESH_EXPIRES_AT: 'REFRESH_EXPIRES_AT',
    MONITORING_SHEET_ID: 'MONITORING_SHEET_ID',
};

const SH = { CONFIG: '설정', MAPPING: '매핑테이블', LOG: '실행로그' };
const C24_PAGE_SIZE = 100;
const DELAY_MS = 300;   // API 호출 간 딜레이 (429 방지)
const TIME_LIMIT_MS = 320000; // 5분 20초 (GAS 6분 제한 대비 여유)
const SYNC_FALLBACK_MAX_AGE_MS = 75 * 60 * 1000;
const PROP = {
    C24_CACHE_DONE: 'C24_CACHE_DONE',
    C24_CACHE_OFFSET: 'C24_CACHE_OFFSET',
    SYNC_PROGRESS_IDX: 'SYNC_PROGRESS_IDX',
    LAST_SYNC_AT: 'LAST_SYNC_AT',
    NEXT_SYNC_SOURCE: 'NEXT_SYNC_SOURCE',
};

// 구형 매핑테이블 CSV 기반 product_no 폴백 (ecount_prod_cd -> cafe24_product_no)
// const LEGACY_PRODUCT_NO_MAP = { "(1)100LVL30308": "1407", "(1)100구조재A14": "1674", "(1)100구조재A16": "1675", "(1)100구조재A18": "1676", "(1)100구조재B110": "1677", "(1)100구조재B112": "1678", "(1)100구조재C22": "1679", "(1)100구조재C24": "1680", "(1)100구조재C26": "1681", "(1)100구조재C28": "1682", "(1)100구조재D212": "1684", "(1)100구조재E70각": "836", "(1)100구조재E90각": "896", "(1)100라왕301400원": "1801", "(1)100라왕심재": "1617", "(1)100라왕한치각": "1616", "(1)100라왕후지": "1618", "(1)100목망꽃바둑1015": "1403", "(1)100목망캡": "1107", "(1)100미송루바8자": "839", "(1)100방부목1120": "1000", "(1)100방부목295": "1000", "(1)100방부목3140": "1000", "(1)100방부목4A22": "1659", "(1)100방부목524": "1660", "(1)100방부목626": "1661", "(1)100방부목8212": "1664", "(1)100방부목91라티": "1177", "(1)100방부목944": "1665", "(1)100방킬8자": "877", "(1)100소송1303012": "1613", "(1)100소송2306912": "1614", "(1)100소송330308": "1611", "(1)100소송4203012": "1615", "(1)100소송53030121": "1614", "(1)100소송63069121": "1614", "(1)100자나무": "975", "(1)100편백루바18유": "1317", "(1)100편백루바8무": "1317", "(1)200A자이01일반93": "1415", "(1)200국산2차음1236": "1622", "(1)200자이02방수936": "1416", "(1)200자이03방화1236": "811", "(1)200자이04일반1236": "1552", "(1)200자이05일반938": "1415", "(1)200하국산방화1236": "1621", "(1)201CRC636": "1164", "(1)201CRC936": "1164", "(1)201석고텍스KCC": "1379", "(1)3001A2748BB": "1604", "(1)3001B448오징": "936", "(1)3001C4648BB": "1604", "(1)3001D4648알": "936", "(1)3001E8548BB": "1604", "(1)3001F8548MLH": "936", "(1)3001G38548콤": "1641", "(1)3001H11548BB": "1604", "(1)3001I11548MLH": "936", "(1)3001J11548콤": "1641", "(1)3001K11548다": "1642", "(1)3001L14548BB": "1604", "(1)3001M17548BB": "1604", "(1)3001Y코아18알": "787", "(1)3001Z코아18라": "787", "(1)300A12736B": "1371", "(1)300A1자작SBB4": "1604", "(1)300A24636B": "1371", "(1)300A2자작SBB6": "1604", "(1)300A38536B": "1371", "(1)300A3자작SBB9": "1604", "(1)300A48536알": "1371", "(1)300A4자작SBB12": "1604", "(1)300A511536B": "1371", "(1)300A5자작SBB15": "1604", "(1)300A611536M": "1371", "(1)300A6자작SBB18": "1604", "(1)300B1미송유48": "783", "(1)300B2미송유85": "783", "(1)300B3미송유12": "783", "(1)300B4미송유15": "783", "(1)300B5미송유18": "783", "(1)300B6미송무45": "959", "(1)300C1낙엽48": "852", "(1)300C2낙엽75": "852", "(1)300C3낙엽115": "852", "(1)300E낙엽18": "852", "(1)300OSB11내": "1565", "(1)300OSB8내": "1565", "(1)300내수1248수": "1018", "(1)300내수21236수": "833", "(1)300백색27": "1015", "(1)300오크27": "936", "(1)300준내수948": "1018", "(1)300태고1248N": "1638", "(1)300태고21236": "833", "(1)301MDF113고밀": "781", "(1)301MDF1245고밀": "781", "(1)301MDF136USB": "781", "(1)301MDF149USB": "781", "(1)301MDF1512USB": "781", "(1)301MDF1615USB": "781", "(1)301MDF1718USB": "781", "(1)301MDF1825UB": "781", "(1)301MDF1930UB": "781", "(1)301MDF206고밀": "1672", "(1)301MDF209고밀": "1672", "(1)301MDF2112고밀": "1672", "(1)301MDF2215고밀": "1672", "(1)301MDF2318고밀": "1672", "(1)302고무12탑": "960", "(1)302고무15탑": "960", "(1)302고무18탑": "960", "(1)302라디12탑": "1655", "(1)302라디15탑": "1655", "(1)302라디18탑": "1655", "(1)302라디24탑": "1655", "(1)302라디30탑": "1655", "(1)302레드12솔": "1801", "(1)302레드15솔": "1801", "(1)302레드18솔": "1801", "(1)302레드60각": "1795", "(1)302멀바1238": "1814", "(1)302멀바1538": "1814", "(1)302멀바1838": "1814", "(1)302멀바1848": "1739", "(1)302멀바계단30300": "927", "(1)302멀바계단38300": "1733", "(1)302미송계단38300": "1733", "(1)302미송대봉9090": "1650", "(1)302미송반달4070": "1284", "(1)302미송소봉4040": "1287", "(1)302미송식빵6070": "1289", "(1)302삼목12솔": "1811", "(1)302삼목15솔": "1811", "(1)302삼목18솔": "1811", "(1)302쏘노30300": "920", "(1)302아카15유": "1772", "(1)302아카18N무": "1776", "(1)302아카18유": "1772", "(1)302에쉬1848": "1645", "(1)302오동12솔": "1174", "(1)500다크브201328": "956", "(1)500도장피스838": "1380", "(1)500미들클립20": "1402", "(1)500스타트클립20": "1865", "(1)500아티론": "869", "(1)500클립피스820": "842", "(1)502백스페": "875", "(1)503스카이비바": "1231", "(1)503차음시트기본": "1701", "(1)503타공라메9": "1228", "(1)503타공원메9": "1227", "(1)60010그라스울기본": "979", "(1)60011아이소101호": "1593", "(1)60011이보드13도배": "1596", "(1)60012아이소20특": "1593", "(1)60012이보드23도배": "1597", "(1)60013아이소30특": "1593", "(1)60013이보드33도배": "1598", "(1)60014아이소50특": "848", "(1)60015아이소100특": "848", "(1)6001열반사10양": "885", "(1)6001열반사6양": "885", "(1)6002열반사10양": "885", "(1)6002열반사6양": "885", "(1)600LXPF301800N": "1546", "(1)600LXPF501800N": "1547", "(1)600LXPF901800N": "1548", "(1)600이보드13페": "1599", "(1)600이보드23페": "1600", "(1)600이보드33페": "1601", "(1)700168401걸레": "1828", "(1)700AL앵글도장": "1692", "(1)700A합7351935": "933", "(1)700B합7352035": "933", "(1)700C합8352035": "933", "(1)700D합9352035": "933", "(1)700E합8002000무": "1563", "(1)700F합8002000유": "1563", "(1)700G합8002100무": "1563", "(1)700H합9002100무": "1589", "(1)700I합9002100유": "1589", "(1)700J합1102100다": "1618", "(1)700K합100800요": "1231", "(1)700L합110900요": "1231", "(1)700P마이너메지95": "1401", "(1)700메지도장95": "987", "(1)700영1162계단": "1398", "(1)700영116301걸레": "1825", "(1)700영116601걸레": "1829", "(1)700영11680020001": "1345", "(1)700영11680020002": "1345", "(1)700영11690021001": "1345", "(1)700영11690021002": "1345", "(1)700영116901걸레": "1830", "(1)700영116P마이너": "1832", "(1)700영116마이너": "1823", "(1)700영116문선": "1830", "(1)700영116시트": "1854", "(1)700영116엣지": "1830", "(1)700영116천정1": "1827", "(1)700영116천정2": "1398", "(1)700영116천정3": "1398", "(1)700영116코너중": "1398", "(1)700영116평100": "1827", "(1)700영116평120": "1827", "(1)700영116평160": "1826", "(1)700영116평200": "1827", "(1)700영116평250": "1827", "(1)700영116평30": "1824", "(1)700영116평300": "1824", "(1)700영116평40": "1822", "(1)700영116평60": "1826", "(1)700영116평80": "1827", "(1)700영116평문선": "1823", "(1)700영161시트": "1854", "(1)700영168301걸레": "1825", "(1)700영16890021002": "1350", "(1)700영168마이너": "1823", "(1)700영168엣지": "1823", "(1)700영168평30": "1824", "(1)700영168평40": "1822", "(1)700영168평60": "1826", "(1)700영169301걸레": "1825", "(1)700영169401걸레": "1828", "(1)700영16990021002": "1350", "(1)700영169마이너": "1823", "(1)700영169엣지": "1823", "(1)700영169평30": "1824", "(1)700영169평40": "1822", "(1)700영169평60": "1826", "(1)700영194301걸레": "1825", "(1)700영194401걸레": "1828", "(1)700영194마이너스": "1823", "(1)700영194평30": "1824", "(1)700영194평40": "1822", "(1)700영194평60": "1826", "(1)700영195301걸레": "1825", "(1)700영195401걸레": "1828", "(1)700영195엣지": "1823", "(1)700영2580020001": "1346", "(1)700영2580020002": "1346", "(1)700영2590021001": "1592", "(1)700영2590021002": "1592", "(1)700영25코너대": "1622", "(1)700영25코너소": "1238", "(1)700영2780020001": "1346", "(1)700영2780020002": "1346", "(1)700영2790021001": "1590", "(1)700영3480020002": "1347", "(1)700영402계단": "1336", "(1)700영403계단": "1238", "(1)700영4080020001": "1348", "(1)700영4080020002": "1348", "(1)700영4090021001": "1593", "(1)700영4090021002": "1593", "(1)700영40901걸레": "1830", "(1)700영40마이너": "1823", "(1)700영40문선": "1238", "(1)700영40엣지": "1238", "(1)700영40천정1": "1335", "(1)700영40천정2": "1336", "(1)700영40천정3": "1337", "(1)700영40코너30": "1824", "(1)700영40코너대": "1231", "(1)700영40코너소": "1822", "(1)700영40코너중": "1238", "(1)700영40평100": "1827", "(1)700영40평120": "1335", "(1)700영40평160": "1826", "(1)700영40평200": "1336", "(1)700영40평250": "1336", "(1)700영40평30": "1238", "(1)700영40평300": "1337", "(1)700영40평40": "1238", "(1)700영40평60": "1238", "(1)700영40평80": "1238", "(1)700영40필름M": "1854", "(1)700영5080020001": "979", "(1)700영5080020002": "979", "(1)700영5090021001": "1593", "(1)700영5090021002": "1593", "(1)700영50엣지": "1233", "(1)700영5380020001": "1827", "(1)700영5380020002": "1827", "(1)700영5390021001": "978", "(1)700영5390021002": "978", "(1)700영53시트": "1854", "(1)700영53엣지": "1237", "(1)700영PS170평40": "1822", "(1)700영P백2계단대": "1843", "(1)700영P백2계단소": "1843", "(1)700영더1167331935": "1341", "(1)700영더1167331960": "1341", "(1)700영더1167332060": "1341", "(1)700영더1168332035": "1342", "(1)700영더1168332060": "1342", "(1)700영더1688332060": "1342", "(1)700영더1698332060": "1342", "(1)700영더257331935": "1341", "(1)700영더258332035": "1342", "(1)700영더277331935": "1341", "(1)700영더278332060": "1342", "(1)700영더347331935": "1341", "(1)700영더348332035": "1342", "(1)700영더407331935": "1341", "(1)700영더408332035": "1342", "(1)700영더408332060": "1342", "(1)700영더537331935": "1341", "(1)700영더537331960": "1341", "(1)700영더538332035": "1342", "(1)700영더538332060": "1342", "(1)700영렉스31208": "1370", "(1)700영렉스31210": "1344", "(1)700영렉스31212": "1346", "(1)700영림P마이너": "1832", "(1)700예HP52130걸레": "1825", "(1)700예HP52140걸레": "1828", "(1)700예HP52230걸레": "1837", "(1)700예HP52240걸레": "1838", "(1)80011실리1투명": "964", "(1)80011이지경실": "912", "(1)80011일반경실": "1332", "(1)80011타카422J": "899", "(1)80012실리반투명": "861", "(1)80012이지경골": "912", "(1)80012일반경골": "1332", "(1)80013실리백색": "964", "(1)80013이지경블": "912", "(1)80013일반경블": "1332", "(1)80013총422": "902", "(1)80014영림이지실버": "912", "(1)80014영림일반실버": "1332", "(1)80014이지경백": "1536", "(1)80014피스톤422": "1810", "(1)800CAP44흑": "1665", "(1)800가위": "967", "(1)800고체연료": "1563", "(1)800골판지": "1864", "(1)800뎀핑레일실": "861", "(1)800레일2": "1210", "(1)800레일3": "1837", "(1)800로라미4": "1247", "(1)800마대80": "1400", "(1)800마대90": "1400", "(1)800마대PP": "1454", "(1)800매거양321": "1359", "(1)800매거양625": "1173", "(1)800매거양632": "1402", "(1)800매거양638": "1402", "(1)800매거외321": "1359", "(1)800매거외625": "1173", "(1)800매거외625코": "1359", "(1)800매거외632": "1402", "(1)800매거외638": "1402", "(1)800비닐대": "1703", "(1)800비닐소": "1593", "(1)800빗자루": "1604", "(1)800빠찌링기본": "1162", "(1)800빠찌링백색": "1425", "(1)800빠찌링스텐": "914", "(1)800사륜로라": "1210", "(1)800사포120": "1224", "(1)800사포220": "1110", "(1)800사포320": "1362", "(1)800사포A원형": "1166", "(1)800서랍레일300": "1289", "(1)800서랍레일350": "983", "(1)800서랍레일400": "1279", "(1)800서랍레일450": "1279", "(1)800서랍레일피스": "983", "(1)800석고본드": "1244", "(1)800스텐피스25": "914", "(1)800스텐피스32": "914", "(1)800스텐피스38": "914", "(1)800스텐피스50": "914", "(1)800스토퍼말굽": "1865", "(1)800스토퍼블랙": "1865", "(1)800스토퍼실버": "1865", "(1)800스톱바": "1400", "(1)800실1701GR": "1330", "(1)800실5000BK": "1860", "(1)800실5000GR": "1326", "(1)800실5000WT": "1861", "(1)800실5001BK": "1862", "(1)800실5001GR": "1327", "(1)800실5001WT": "1863", "(1)800실5100GR": "1328", "(1)800실5101GR": "1329", "(1)800실6401GR": "1331", "(1)800실리B1투명": "863", "(1)800실리B반투명": "863", "(1)800실리B백색": "863", "(1)800실리C백색": "864", "(1)800실리골드": "861", "(1)800실리밤색": "964", "(1)800실리아이보리": "861", "(1)800실리우드": "898", "(1)800실리체리": "964", "(1)800실리콘건": "861", "(1)800실리회색": "964", "(1)800실리흑색": "964", "(1)800실타615": "913", "(1)800실타618": "913", "(1)800실타625": "913", "(1)800실타630": "913", "(1)800쓰레받": "1239", "(1)800씽크경유15": "985", "(1)800씽크경유18": "985", "(1)800씽크경일15": "985", "(1)800씽크경일18": "985", "(1)800씽크경피스": "985", "(1)800아연피스25": "929", "(1)800아연피스32": "929", "(1)800아연피스38": "929", "(1)800아연피스50": "929", "(1)800아연피스65": "929", "(1)800아연피스75": "929", "(1)800아연피스90": "842", "(1)800액자레일2": "1425", "(1)800에어건": "902", "(1)800엘가이드": "1400", "(1)800오메가12": "1279", "(1)800오메가7": "1279", "(1)800오메가8": "1279", "(1)800오메가9": "1279", "(1)800오목손사각": "967", "(1)800오목손은": "967", "(1)800오목손타원": "967", "(1)800오일116투명": "1245", "(1)800오일135투명": "1683", "(1)800오일16도토리": "1245", "(1)800오일16밤색": "1245", "(1)800오일16월넛": "1245", "(1)800오일16코코넛": "1245", "(1)800오일16티크": "1245", "(1)800오일16흑단": "1245", "(1)800오일16흑색": "1245", "(1)800오일35다크오렌": "1245", "(1)800오일35도토리": "1417", "(1)800오일35레드와인": "1245", "(1)800오일35마호가니": "1414", "(1)800오일35밝은오크": "1245", "(1)800오일35밤색": "1245", "(1)800오일35살구색": "1245", "(1)800오일35연녹색": "1245", "(1)800오일35연밤색": "1245", "(1)800오일35월넛": "1245", "(1)800오일35자단": "1245", "(1)800오일35참나무": "825", "(1)800오일35체리": "861", "(1)800오일35코코넛": "1245", "(1)800오일35티크": "1245", "(1)800오일35화이트": "1499", "(1)800오일35황색": "1245", "(1)800오일35흑단": "1245", "(1)800오일35흑색": "1245", "(1)800윙스25": "988", "(1)800윙스252": "988", "(1)800윙스32": "988", "(1)800윙스38": "988", "(1)800윙스45": "988", "(1)800윙스55": "988", "(1)800유리다보": "967", "(1)800자유경3": "1855", "(1)800자유경4": "1855", "(1)800장갑1코팅R": "987", "(1)800장갑기능대": "987", "(1)800장갑기능소": "987", "(1)800장갑기능중": "987", "(1)800점검300": "1401", "(1)800점검400": "1401", "(1)800점검450": "1401", "(1)800점검600": "1401", "(1)800점검AL600": "1401", "(1)800점검PVC300": "1401", "(1)800점검PVC400": "1401", "(1)800점검PVC450": "1401", "(1)800점검PVC600": "1401", "(1)800접시13": "910", "(1)800접시25": "910", "(1)800접시32": "910", "(1)800접시38": "910", "(1)800접착205": "980", "(1)800접착777": "849", "(1)800접착G1원": "1242", "(1)800접착G2원": "1243", "(1)800접착G3원": "1244", "(1)800접착아이소": "848", "(1)800접착에폭4": "850", "(1)800접착에폭A10": "850", "(1)800접착프라1": "1244", "(1)800접착프라3": "1244", "(1)800줄자55국": "1851", "(1)800줄자55세": "1851", "(1)800줄자55타": "1842", "(1)800줄자75타": "842", "(1)800철기리30": "1703", "(1)800철기리32": "1683", "(1)800철기리33": "1683", "(1)800총1850A": "902", "(1)800총630R": "902", "(1)800총BN1664": "902", "(1)800총CT64": "902", "(1)800총F30": "902", "(1)800칼브럭625": "913", "(1)800칼브럭640": "1806", "(1)800칼브럭812": "1666", "(1)800칼브럭890": "1593", "(1)800캇타칼": "1642", "(1)800캇타칼고급": "1269", "(1)800캇타칼날": "1401", "(1)800콩피스816": "988", "(1)800타카1022J": "899", "(1)800타카1ST18": "1173", "(1)800타카1ST25": "1173", "(1)800타카1ST32": "1173", "(1)800타카1ST38": "1173", "(1)800타카1ST45": "1173", "(1)800타카1ST50": "1173", "(1)800타카1ST57": "1173", "(1)800타카1ST64": "1173", "(1)800타카416J": "899", "(1)800타카419J": "899", "(1)800타카DT50": "856", "(1)800타카DT64": "1180", "(1)800타카F15": "913", "(1)800타카F20": "1362", "(1)800타카F25": "1705", "(1)800타카F30": "1195", "(1)800타카F40": "1238", "(1)800타카F50": "1709", "(1)800타카FST15": "1173", "(1)800타카FST18": "1173", "(1)800타카FST25": "1173", "(1)800타카FST30": "1173", "(1)800타카JST18": "1704", "(1)800타카JST25": "1705", "(1)800타카JST32": "1706", "(1)800타카JST38": "1707", "(1)800타카JST45": "1708", "(1)800타카JST50": "1709", "(1)800타카JST64": "1710", "(1)800타카T50": "901", "(1)800타카T57": "1534", "(1)800타카T64": "1240", "(1)800테잎25은": "890", "(1)800테잎50은": "890", "(1)800테잎마스대": "1667", "(1)800테잎마스소": "1670", "(1)800테잎박스": "1865", "(1)800테잎청": "1865", "(1)800테잎커버2000": "1666", "(1)800테잎커버2700": "1666", "(1)800테잎커버900": "1666", "(1)800테잎플로": "838", "(1)800텐텐지": "1536", "(1)800톱날265대": "1614", "(1)800톱날300대": "1614", "(1)800톱날330대": "1612", "(1)800톱날A265타": "909", "(1)800톱날A300타": "1614", "(1)800톱날A330타": "1612", "(1)800톱대": "1856", "(1)800퍼티20": "842", "(1)800퍼티5": "1865", "(1)800평붓2": "908", "(1)800평붓3": "908", "(1)800평붓4": "908", "(1)800평붓5": "908", "(1)800플로3": "978", "(1)800피스다보": "967", "(1)800피스톤630": "913", "(1)800피스톤CT64": "1240", "(1)800피스톤F30": "1195", "(1)800하폼건월드1": "1819", "(1)800하폼건월드2": "1818", "(1)800하폼건월드3": "1821", "(1)800하폼건월드4": "1857", "(1)800하폼건월드5": "1858", "(1)800하폼건월드8": "857", "(1)800하폼건월드9": "1859", "(1)800하폼크리너": "859", "(1)800핫멜트1심": "1244", "(1)800핫멜트건": "845", "(1)800핫팩": "1243", "(1)800행가노출2": "1160", "(1)800행가레일2": "1400", "(1)800행가양댐30": "1353", "(1)800행가양댐50": "1846", "(1)800행가양댐80": "1846", "(1)800행가하부촉": "1400", "(1)800헤라대": "964", "(1)800헤라소": "964", "(1)800헤라중": "964", "(1)800호스10": "1414", "(1)800호스20": "1414", "(1)800호스30": "1414", "(1)800호차30": "1781", "(1)A100뉴송11317": "836", "(1)A100뉴송21727": "836", "(1)A100뉴송32727": "836", "(1)800골판지테스트": "1866" };

// 실행 중 공유 상태
let G_TOKEN = '';
let G_CFG = null;
let G_SS = null;
let G_MON_SS = null;   // 모니터링 시트 (토큰 저장소)
let G_CONSEC_FAIL = 0;
let G_EXEC_SOURCE = '';
let G_AUTH_ALERT_SENT = false;


// ════════════════════════════════════════════════════════
// ■ 커스텀 메뉴
// ════════════════════════════════════════════════════════

function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🛠️ 카페24 동기화')
        .addItem('▶ 즉시 동기화 (카페24 다운로드 + 가격 업데이트)', 'runManualBuildCafe24Cache')
        .addSeparator()
        .addItem('카페24 캐시 전체 초기화', 'runManualInitCafe24Cache')
        .addSeparator()
        .addItem('[1회성] DB 품목코드 채우기', 'runOneOffFillDbProductCodes')
        .addSeparator()
        .addItem('트리거 설정 (1시간마다)', 'createTrigger')
        .addToUi();
  } catch (e) {
    // WebApp 컨텍스트에서는 getUi() 사용 불가 — 무시
  }
}

function runManualBuildCafe24Cache() {
    G_EXEC_SOURCE = 'MANUAL';
    buildCafe24Cache();
}

function runManualInitCafe24Cache() {
    G_EXEC_SOURCE = 'MANUAL';
    initCafe24Cache();
}


// ════════════════════════════════════════════════════════
// ■ 메인 함수
// ════════════════════════════════════════════════════════

function syncPrices() {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) {
        Logger.log('[syncPrices] 다른 syncPrices 실행 중 → 이번 실행 스킵');
        return;
    }

    const start = new Date();
    const source = consumeSyncExecutionSource_();
    const logs = [];
    let updated = 0, skipped = 0, errors = 0;
    const newMappingRows = [];
    const unmappedRows = [];

    try {
        // ── Step 1. 설정 로드 ─────────────────────────────────
        G_SS = getSpreadsheet();
        G_CFG = readConfig(G_SS);
        initMonitoringSheet_(G_CFG);   // 모니터링 시트에서 토큰 오버레이
        G_TOKEN = G_CFG[KEY.C24_ACCESS_TOKEN] || '';
        Logger.log(`Step1: 설정 로드 완료 | DRY_RUN=${G_CFG[KEY.DRY_RUN]}`);
        logs.push(`[${now()}] Step1: 설정 로드 완료`);

        // ── Step 2. 이카운트 가격 조회 ────────────────────────
        Logger.log('Step2: 이카운트 로그인...');
        const sessionId = ecLogin(G_CFG);
        const { prices: ecPrices, descriptions: ecDescriptions } = fetchEcountPrices(G_CFG, sessionId);
        Logger.log(`Step2: 이카운트 ${Object.keys(ecPrices).length}건 조회 완료`);
        logs.push(`[${now()}] Step2: 이카운트 ${Object.keys(ecPrices).length}건`);

        // ── Step 2.0 카페24상품 시트 G열에 PROD_DES 저장 ───────────
        try {
            writeProdDesToCafe24Sheet_(G_SS, ecDescriptions);
            Logger.log('Step2.0: [카페24상품] G열 PROD_DES 저장 완료');
            logs.push(`[${now()}] Step2.0: 카페24상품 G열 PROD_DES 저장`);
        } catch (e) {
            Logger.log('Step2.0: PROD_DES 저장 실패: ' + e.message);
            logs.push(`[${now()}] Step2.0: PROD_DES 저장 실패`);
        }

        // ── Step 2.1 monitoring-gas 토큰 상태 확인 ─────────────
        checkMonitoringTokenState_(G_CFG, 'syncPrices');
        logs.push(`[${now()}] Step2.1: monitoring-gas 토큰 확인 완료`);

        const mallId = G_CFG[KEY.C24_MALL_ID];
        const apiVer = G_CFG[KEY.C24_API_VERSION] || '2025-12-01';

        // ── Step 4. 카페24 캐시 로드 (additional_amount 포함) ─────
        if (!isCafe24CacheDone_()) {
            Logger.log('Step4: 카페24 캐시 미완성 → syncPrices 종료');
            logs.push(`[${now()}] Step4: 카페24 캐시 미완성`);
            writeLog(G_SS, start, source, updated, skipped, errors, logs.join('\n'));
            return;
        }

        const cafe24Cache = readCafe24SheetCache(G_SS);
        const cacheSize = Object.keys(cafe24Cache).length;
        Logger.log(`Step4: 카페24 캐시 로드 ${cacheSize}건`);
        logs.push(`[${now()}] Step4: 카페24 캐시 ${cacheSize}건 로드`);

        const debugProductNo = G_CFG[KEY.DEBUG_PRODUCT_NO];
        if (debugProductNo) {
            checkProductNoInCatalog(mallId, apiVer, debugProductNo);
        }

        // ── Step 5. 이카운트 가격 vs 카페24 additional_amount 비교 → 변동 항목만 업데이트 ──
        Logger.log('Step5: 가격 변동 감지 및 타겟 업데이트 시작...');
        logs.push(`[${now()}] Step5: 타겟 업데이트 시작`);

        const entries = Object.entries(cafe24Cache);
        const startIdx = getSyncProgress_();
        Logger.log(`Step5: 진행 시작 인덱스=${startIdx}/${entries.length}`);

        for (let i = startIdx; i < entries.length; i++) {
            const [customCode, cacheEntries] = entries[i];
            if (new Date() - start > TIME_LIMIT_MS) {
                Logger.log(`시간 제한 접근 (${((new Date() - start) / 1000).toFixed(0)}s) → 진행 상태 저장 후 중단`);
                logs.push(`[${now()}] 시간 제한으로 중단 (idx 저장)`);
                setSyncProgress_(i);
                break;
            }

            const hasEcountPrice = Object.prototype.hasOwnProperty.call(ecPrices, customCode);
            if (!hasEcountPrice) {
                unmappedRows.push([customCode, '', now()]);
                skipped++;
                continue;
            }

            const ecPrice = ecPrices[customCode];
            const priceWithVat = Math.round(ecPrice * 1.1);

            // 동일 custom_variant_code에 묶인 모든 variant 처리
            for (const { productNo, variantCode, cachedPrice } of cacheEntries) {
                // additional_amount vs ecount_price_vat 비교
                if (Math.round(cachedPrice) === priceWithVat) {
                    newMappingRows.push([customCode, productNo, variantCode, priceWithVat, now(), '스킵(변동없음)']);
                    skipped++;
                    continue;
                }

                Logger.log(`변동: ${customCode} | variant=${variantCode} | additional_amount=${cachedPrice} → ecount_vat=${priceWithVat}`);
                logs.push(`[${now()}] 변동: ${customCode} | variant=${variantCode} | ${cachedPrice} → ${priceWithVat}`);

                if (G_CFG[KEY.DRY_RUN] === 'true') {
                    newMappingRows.push([customCode, productNo, variantCode, priceWithVat, now(), 'DRY_RUN']);
                    updated++;
                    continue;
                }

                // 단품(variant 없음) → product price 직접 업데이트
                if (!variantCode) {
                    const pRes = updateProductPriceDirect(mallId, apiVer, productNo, priceWithVat);
                    if (pRes.ok) {
                        Logger.log(`단품 업데이트 성공: ${customCode} | product_no=${productNo} | ${cachedPrice} → ${priceWithVat} (${pRes.status})`);
                        logs.push(`  └ 성공(단품) (${pRes.status}): ${customCode}`);
                        newMappingRows.push([customCode, productNo, '', priceWithVat, now(), '성공(단품)']);
                        updated++;
                    } else {
                        Logger.log(`단품 업데이트 실패: ${customCode} | status=${pRes.status}`);
                        logs.push(`  └ 실패(단품) (${pRes.status}): ${customCode}`);
                        newMappingRows.push([customCode, productNo, '', priceWithVat, now(), `실패(단품)(${pRes.status})`]);
                        errors++;
                    }
                    Utilities.sleep(DELAY_MS);
                    continue;
                }

                // 카페24 직접 PUT (product_no + variant_code 사용)
                const url = `https://${mallId}.cafe24api.com/api/v2/admin/products/${productNo}/variants/${variantCode}`;
                const payload = { shop_no: 1, request: { additional_amount: String(priceWithVat) } };
                const res = c24Put(url, apiVer, payload);

                if (res.ok) {
                    Logger.log(`업데이트 성공: ${customCode} | product_no=${productNo} | variant=${variantCode} | ${cachedPrice} → ${priceWithVat} (${res.status})`);
                    logs.push(`  └ 성공 (${res.status}): ${customCode} | variant=${variantCode}`);
                    newMappingRows.push([customCode, productNo, variantCode, priceWithVat, now(), '성공']);
                    updated++;
                } else {
                    Logger.log(`업데이트 실패: ${customCode} | variant=${variantCode} | status=${res.status} | ${res.body.substring(0, 80)}`);
                    logs.push(`  └ 실패 (${res.status}): ${customCode} | variant=${variantCode}`);
                    newMappingRows.push([customCode, productNo, variantCode, priceWithVat, now(), `실패(${res.status})`]);
                    errors++;
                }

                Utilities.sleep(DELAY_MS);
            }
        }

        clearSyncProgress_();

        // ── Step 6. 매핑테이블 갱신 ──────────────────────────
        if (newMappingRows.length > 0) {
            writeMappingTable(G_SS, newMappingRows);
            Logger.log(`Step6: 매핑테이블 ${newMappingRows.length}건 갱신`);
            logs.push(`[${now()}] Step6: 매핑테이블 ${newMappingRows.length}건 갱신`);
        }

        if (unmappedRows.length > 0) {
            const unmappedSheet = G_SS.getSheetByName('미매핑');
            if (unmappedSheet && unmappedSheet.getLastRow() > 1) {
                unmappedSheet.getRange(2, 1, unmappedSheet.getLastRow() - 1, 3).clearContent();
            }
            writeUnmappedSheet(G_SS, unmappedRows);
            Logger.log(`Step6: 미매핑 ${unmappedRows.length}건 기록`);
            logs.push(`[${now()}] Step6: 미매핑 ${unmappedRows.length}건 기록`);
        }

    } catch (e) {
        errors++;
        Logger.log('오류 발생: ' + e.message + '\n' + (e.stack || ''));
        logs.push(`[${now()}] 오류: ${e.message}`);
        notifyAdmin_(G_CFG, `syncPrices 실행 실패: ${e.message}`);
    }

    try {
        // ── Step 7. 실행로그 기록 ─────────────────────────────
        const elapsed = ((new Date() - start) / 1000).toFixed(1);
        const summary = `[${now()}] 완료 — 업데이트:${updated} 스킵:${skipped} 오류:${errors} (${elapsed}s)`;
        logs.push(summary);
        Logger.log(summary);
        if (G_SS) writeLog(G_SS, start, source, updated, skipped, errors, logs.join('\n'));

        if (errors > 0) {
            notifyAdmin_(G_CFG, `syncPrices 오류 발생: ${errors}건\n${summary}`);
        }
    } finally {
        markSyncExecuted_(start);
        lock.releaseLock();
    }
}


// ════════════════════════════════════════════════════════
// ■ 자동 트리거 (1회 실행)
// ════════════════════════════════════════════════════════

function createTrigger() {
    const targets = ['syncPrices', 'syncPricesFallback', 'buildCafe24Cache', 'checkNewProducts', 'autoRefreshCafe24Token'];
    for (const t of ScriptApp.getProjectTriggers()) {
        if (targets.includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
    }
    // autoRefreshCafe24Token 트리거 제거 — 토큰 갱신은 monitoring-gas(1시간)가 단독 담당
    ScriptApp.newTrigger('buildCafe24Cache').timeBased().everyHours(1).create();
    ScriptApp.newTrigger('syncPricesFallback').timeBased().everyHours(1).create();
    // syncPrices는 고정 트리거 없음 — buildCafe24Cache 완료 후 10분 딜레이 one-time 트리거로 실행
    Logger.log('✅ buildCafe24Cache 1시간, syncPricesFallback 1시간 트리거 생성 완료 (syncPrices는 buildCafe24Cache 완료 후 자동 예약 / 토큰 갱신은 monitoring-gas 담당)');
}

/**
 * syncPrices one-time 트리거 예약 (10분 후).
 * 기존 대기 중인 syncPrices one-time 트리거가 있으면 먼저 삭제 후 재등록.
 */
function scheduleSyncPricesOnce_() {
    const source = resolveExecutionSource_('AUTO');
    // 기존 syncPrices 트리거(one-time 포함) 모두 제거
    for (const t of ScriptApp.getProjectTriggers()) {
        if (t.getHandlerFunction() === 'syncPrices') ScriptApp.deleteTrigger(t);
    }
    setNextSyncSource_(source);
    ScriptApp.newTrigger('syncPrices').timeBased().after(10 * 60 * 1000).create();
    Logger.log(`[scheduleSyncPricesOnce_] syncPrices 10분 후 one-time 트리거 등록 완료 | source=${source}`);
}

function syncPricesFallback() {
    const lastSyncAt = getLastSyncAt_();
    if (lastSyncAt && (Date.now() - lastSyncAt.getTime()) < SYNC_FALLBACK_MAX_AGE_MS) {
        Logger.log('[syncPricesFallback] 최근 syncPrices 실행 감지 → 스킵');
        return;
    }

    Logger.log('[syncPricesFallback] 최근 syncPrices 실행 공백 감지 → fallback 실행');
    G_EXEC_SOURCE = 'AUTO';
    syncPrices();
}



// ════════════════════════════════════════════════════════
// ■ 카페24 API
// ════════════════════════════════════════════════════════

/** 401 감지 시 monitoring-gas 시트의 최신 access token을 한 번 다시 읽는다. */
function reloadMonitoringTokenOrThrow_(context) {
    if (!G_MON_SS) {
        throwAuthFailure_(context, 'monitoring-gas 시트가 초기화되지 않음');
    }

    try {
        const freshCfg = readConfig(G_MON_SS);
        const freshToken = freshCfg[KEY.C24_ACCESS_TOKEN];
        if (!freshToken) {
            throwAuthFailure_(context, 'monitoring-gas access token 없음');
        }
        if (freshToken === G_TOKEN) {
            throwAuthFailure_(context, 'monitoring-gas 토큰이 기존 토큰과 동일함');
        }

        G_TOKEN = freshToken;
        G_CFG[KEY.C24_ACCESS_TOKEN] = freshToken;
        if (freshCfg[KEY.TOKEN_EXPIRES_AT]) G_CFG[KEY.TOKEN_EXPIRES_AT] = freshCfg[KEY.TOKEN_EXPIRES_AT];
        if (freshCfg[KEY.REFRESH_EXPIRES_AT]) G_CFG[KEY.REFRESH_EXPIRES_AT] = freshCfg[KEY.REFRESH_EXPIRES_AT];
        Logger.log(`[Auth401] ${context}: monitoring-gas 최신 access token으로 교체 완료`);
    } catch (e) {
        if (isAuthFailure_(e)) throw e;
        throwAuthFailure_(context, 'monitoring-gas 재조회 실패: ' + e.message);
    }
}

/** GET — 401 자동 재시도 */

// 연속 실패 카운터 관리
function recordApiFailure_(cfg, message) {
    G_CONSEC_FAIL += 1;
    if (G_CONSEC_FAIL >= 5) {
        notifyAdmin_(cfg, `카페24 API 연속 실패 ${G_CONSEC_FAIL}회 이상: ${message}`);
        // 중복 알림 방지용 리셋
        G_CONSEC_FAIL = 0;
    }
}
function recordApiSuccess_() {
    G_CONSEC_FAIL = 0;
}

function c24Get(url, apiVersion) {
    const res = _rawGet(url, apiVersion, G_TOKEN);
    if (res.status === 401) {
        reloadMonitoringTokenOrThrow_('c24Get 최초 401');
        const r2 = _rawGet(url, apiVersion, G_TOKEN);
        if (r2.status === 401) throwAuthFailure_('c24Get 재시도 401', 'monitoring-gas 최신 토큰도 거부됨');
        if (!r2.ok) recordApiFailure_(G_CFG, `GET 실패 status=${r2.status}`); else recordApiSuccess_();
        return r2;
    }
    if (!res.ok) recordApiFailure_(G_CFG, `GET 실패 status=${res.status}`); else recordApiSuccess_();
    return res;
}


/** PUT — 401 자동 재시도 */
function c24Put(url, apiVersion, payload) {
    const res = _rawPut(url, apiVersion, G_TOKEN, payload);
    if (res.status === 401) {
        reloadMonitoringTokenOrThrow_('c24Put 최초 401');
        const r2 = _rawPut(url, apiVersion, G_TOKEN, payload);
        if (r2.status === 401) throwAuthFailure_('c24Put 재시도 401', 'monitoring-gas 최신 토큰도 거부됨');
        if (!r2.ok) recordApiFailure_(G_CFG, `PUT 실패 status=${r2.status}`); else recordApiSuccess_();
        return r2;
    }
    if (!res.ok) recordApiFailure_(G_CFG, `PUT 실패 status=${res.status}`); else recordApiSuccess_();
    return res;
}


/** product_no 기준 price 직접 업데이트 (variant 미매칭 폴백) */
function updateProductPriceDirect(mallId, apiVersion, productNo, price) {
    const url = `https://${mallId}.cafe24api.com/api/v2/admin/products/${productNo}`;
    const payload = { request: { product: { price: Math.round(price) } } };
    return c24Put(url, apiVersion, payload);
}

function _rawGet(url, apiVersion, token) {
    const doGet = () => UrlFetchApp.fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'X-Cafe24-Api-Version': apiVersion },
        muteHttpExceptions: true,
        validateHttpsCertificates: false,
    });

    const backoffs = [1000, 2000, 4000, 8000];
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            const res = doGet();
            const status = res.getResponseCode();
            const body = res.getContentText();

            if (status === 412) {
                Logger.log(`[rawGet] 412 발생. 조건/요청 로그 저장: url=${url}`);
            }
            if (status === 429 || status === 412) {
                if (attempt < 3) {
                    const waitMs = backoffs[attempt];
                    Logger.log(`[rawGet] ${status} 발생. ${waitMs}ms 후 재시도 (${attempt + 1}/3)`);
                    Utilities.sleep(waitMs);
                    continue;
                }
            }

            return { ok: status >= 200 && status < 300, status, body };
        } catch (e) {
            const msg = String(e && e.message ? e.message : e);
            if (msg.toLowerCase().includes('address unavailable')) {
                Logger.log('[rawGet] Address unavailable. 5초 후 1회 재시도...');
                Utilities.sleep(5000);
                try {
                    const res = doGet();
                    const status = res.getResponseCode();
                    return { ok: status >= 200 && status < 300, status, body: res.getContentText() };
                } catch (e2) {
                    return { ok: false, status: 0, body: String(e2 && e2.message ? e2.message : e2) };
                }
            }
            return { ok: false, status: 0, body: msg };
        }
    }
    return { ok: false, status: 0, body: 'retry_exceeded' };
}


function _rawPut(url, apiVersion, token, payload) {
    const doPut = () => UrlFetchApp.fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Cafe24-Api-Version': apiVersion,
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
        validateHttpsCertificates: false,
    });

    const backoffs = [1000, 2000, 4000, 8000];
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            const res = doPut();
            const status = res.getResponseCode();
            const body = res.getContentText();

            if (status === 412) {
                Logger.log(`[rawPut] 412 발생. 조건/요청 로그 저장: url=${url} payload=${JSON.stringify(payload)}`);
            }
            if (status === 429 || status === 412) {
                if (attempt < 3) {
                    const waitMs = backoffs[attempt];
                    Logger.log(`[rawPut] ${status} 발생. ${waitMs}ms 후 재시도 (${attempt + 1}/3)`);
                    Utilities.sleep(waitMs);
                    continue;
                }
            }

            return { ok: status >= 200 && status < 300, status, body };
        } catch (e) {
            const msg = String(e && e.message ? e.message : e);
            if (msg.toLowerCase().includes('address unavailable')) {
                Logger.log('[rawPut] Address unavailable. 5초 후 1회 재시도...');
                Utilities.sleep(5000);
                try {
                    const res = doPut();
                    const status = res.getResponseCode();
                    return { ok: status >= 200 && status < 300, status, body: res.getContentText() };
                } catch (e2) {
                    return { ok: false, status: 0, body: String(e2 && e2.message ? e2.message : e2) };
                }
            }
            return { ok: false, status: 0, body: msg };
        }
    }
    return { ok: false, status: 0, body: 'retry_exceeded' };
}


// 전체 상품 목록 조회는 사용하지 않음 (타겟 동기화만 수행)

/** 디버그: 전체 상품 목록에서 특정 product_no 존재 여부 확인 (필요 시만 사용) */
function checkProductNoInCatalog(mallId, apiVersion, targetNo) {
    if (!targetNo) return false;
    let offset = 0;
    let found = false;
    let total = 0;
    while (true) {
        const url = `https://${mallId}.cafe24api.com/api/v2/admin/products?limit=${C24_PAGE_SIZE}&offset=${offset}&fields=product_no`;
        const res = c24Get(url, apiVersion);
        if (!res.ok) {
            Logger.log(`[DEBUG_PRODUCT_NO] 상품 목록 조회 오류: ${res.status}`);
            break;
        }
        const products = JSON.parse(res.body).products || [];
        if (products.length === 0) break;
        total += products.length;
        if (products.some(p => String(p.product_no) === String(targetNo))) {
            found = true;
        }
        if (products.length < C24_PAGE_SIZE) break;
        offset += C24_PAGE_SIZE;
        Utilities.sleep(300);
    }
    Logger.log(`[DEBUG_PRODUCT_NO] product_no=${targetNo} 포함 여부: ${found}`);
    Logger.log(`[DEBUG_PRODUCT_NO] 상품 총 조회 건수: ${total}`);
    Logger.log(`[DEBUG_PRODUCT_NO] 898건 이상 조회 여부: ${total >= 898}`);
    return found;
}



/** 카페24 캐시 상태 */
function isCafe24CacheDone_() {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(PROP.C24_CACHE_DONE) === 'true';
}

/** 카페24 캐시 완료 플래그/오프셋 업데이트 */
function setCafe24CacheState_(done, nextOffset) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(PROP.C24_CACHE_DONE, done ? 'true' : 'false');
    if (done) {
        props.deleteProperty(PROP.C24_CACHE_OFFSET);
    } else {
        props.setProperty(PROP.C24_CACHE_OFFSET, String(nextOffset));
    }
}

/** 카페24상품 시트에서 캐시 로드
 * 동일 custom_variant_code에 여러 variant가 있을 수 있으므로 배열로 저장
 * @returns {{ [customCode]: Array<{productNo, variantCode, cachedPrice}> }}
 */
function readCafe24SheetCache(ss) {
    const sh = ss.getSheetByName('카페24상품');
    const cache = {};
    if (!sh) return cache;
    const data = sh.getDataRange().getValues();
    if (data.length <= 1) return cache;
    for (let i = 1; i < data.length; i++) {
        const productNo = String(data[i][0] || '').trim();
        const customCode = String(data[i][3] || '').trim();
        const variantCode = String(data[i][4] || '').trim();
        const price = parseFloat(String(data[i][5] || '0').replace(/,/g, '')) || 0;
        if (customCode && productNo && variantCode) {
            if (!cache[customCode]) cache[customCode] = [];
            cache[customCode].push({ productNo, variantCode, cachedPrice: price });
        }
    }
    return cache;
}

/** 카페24상품 시트 저장 (배치) */
function writeCafe24SheetBatch(ss, rows, reset) {
    let sh = ss.getSheetByName('카페24상품');
    if (!sh) sh = ss.insertSheet('카페24상품');
    const header = ['product_no', 'product_code', 'product_name', 'custom_variant_code', 'variant_code', 'additional_amount'];
    if (reset) {
        sh.clearContents();
        sh.getRange(1, 1, 1, header.length).setValues([header]);
    }
    if (rows.length > 0) {
        const startRow = sh.getLastRow() + 1;
        sh.getRange(startRow, 1, rows.length, header.length).setValues(rows);
    }
}

/** 카페24 전체 상품/옵션 조회 (1회 100건씩) */

/** 신규 상품 증분 동기화 */
function checkNewProducts() {
    const ss = getSpreadsheet();
    const cfg = readConfig(ss);
    G_CFG = cfg;
    G_SS = ss;
    initMonitoringSheet_(G_CFG);
    G_TOKEN = G_CFG[KEY.C24_ACCESS_TOKEN] || '';

    checkMonitoringTokenState_(cfg, 'checkNewProducts');

    // 이카운트 가격 전체 조회 (PROD_CD 목록 확보)
    const sessionId = ecLogin(cfg);
    const { prices: ecPrices, descriptions: ecDescriptions } = fetchEcountPrices(cfg, sessionId);

    // 매핑테이블 캐시 로드
    const mappingCache = readMappingTable(ss);

    const mallId = cfg[KEY.C24_MALL_ID];
    const apiVer = cfg[KEY.C24_API_VERSION] || '2025-12-01';

    const newRows = [];
    const newMappings = [];

    for (const [prodCd, price] of Object.entries(ecPrices)) {
        if (mappingCache[prodCd]) continue;

        // 신규 PROD_CD: 카페24 캐시 시트에서 검색
        const cache = readCafe24SheetCache(ss);
        const auto = cache[prodCd];
        if (auto) {
            mappingCache[prodCd] = auto;
            newMappings.push([prodCd, auto.productNo, auto.variantCode, Math.round(price * 1.1), now(), '자동등록(증분)']);
            continue;
        }

        // 캐시에 없으면 카페24 전체 조회 대신 product_no 미정 → 스킵 기록
        const desc = ecDescriptions[prodCd] || '';
        newRows.push([prodCd, desc, now()]);
    }

    if (newMappings.length > 0) {
        writeMappingTable(ss, newMappings);
        Logger.log(`[checkNewProducts] 신규 매핑 ${newMappings.length}건 등록`);
    }

    if (newRows.length > 0) {
        const unmappedSheet = ss.getSheetByName('미매핑');
        if (unmappedSheet && unmappedSheet.getLastRow() > 1) {
            unmappedSheet.getRange(2, 1, unmappedSheet.getLastRow() - 1, 3).clearContent();
        }
        writeUnmappedSheet(ss, newRows);
        Logger.log(`[checkNewProducts] 미매핑 ${newRows.length}건 기록`);
    }
}

/**
 * 카페24 상품 캐시 전체 초기화 (시트 전체 삭제 후 전체 재다운로드).
 * [초기화] 버튼 또는 최초 1회 실행용.
 */
function initCafe24Cache() {
    const source = resolveExecutionSource_('AUTO');
    const ss = getSpreadsheet();
    const cfg = readConfig(ss);
    G_CFG = cfg;
    G_SS = ss;
    initMonitoringSheet_(G_CFG);
    G_TOKEN = G_CFG[KEY.C24_ACCESS_TOKEN] || '';

    checkMonitoringTokenState_(cfg, 'initCafe24Cache');

    const mallId = cfg[KEY.C24_MALL_ID];
    const apiVer = cfg[KEY.C24_API_VERSION] || '2025-12-01';
    const limit = 100;
    const header = ['product_no', 'product_code', 'product_name', 'custom_variant_code', 'variant_code', 'additional_amount'];

    // [카페24상품] 시트 전체 초기화
    let sh = ss.getSheetByName('카페24상품');
    if (!sh) sh = ss.insertSheet('카페24상품');
    sh.clearContents();
    sh.getRange(1, 1, 1, header.length).setValues([header]);

    // ScriptProperties 리셋
    const props = PropertiesService.getScriptProperties();
    props.setProperty('C24_CACHE_OFFSET', '0');
    props.setProperty('C24_CACHE_DONE', 'false');

    let offset = 0;
    let totalVariants = 0;
    let totalSaved = 0;

    while (true) {
        Logger.log(`[initCafe24Cache] offset=${offset} 조회 중...`);
        const products = fetchCafe24ProductsPage_(mallId, apiVer, offset, limit);
        if (!products) { Logger.log('[initCafe24Cache] 상품 목록 조회 실패 — 중단'); break; }

        const rows = [];
        let pageVariants = 0;
        for (const product of products) {
            const productNo = String(product.product_no || '');
            const productCode = String(product.product_code || '');
            const productName = String(product.product_name || '');
            if (!productNo) continue;
            const variants = fetchProductVariants(mallId, apiVer, productNo);
            for (const v of variants) {
                pageVariants++;
                const customCode = String(v.custom_variant_code || '').trim();
                if (!customCode) continue;
                const variantCode = String(v.variant_code || '').trim();
                const price = parseFloat(String(v.additional_amount || '0').replace(/,/g, '')) || 0;
                rows.push([productNo, productCode, productName, customCode, variantCode, price]);
            }
        }

        if (rows.length > 0) {
            const startRow = sh.getLastRow() + 1;
            sh.getRange(startRow, 1, rows.length, header.length).setValues(rows);
        }

        totalVariants += pageVariants;
        totalSaved += rows.length;
        Logger.log(`[initCafe24Cache] offset=${offset} variants=${pageVariants} 저장=${rows.length} (누적 ${totalSaved}건 / 전체 ${totalVariants}건)`);

        if (products.length < limit) break;
        offset += limit;
    }

    setCafe24CacheState_(true, 0);
    Logger.log(`[initCafe24Cache] ✅ 완료 — 저장 ${totalSaved}건 / 전체 variants ${totalVariants}건 / 미설정 제외 ${totalVariants - totalSaved}건`);

    // syncPrices one-time 트리거 예약 (10분 후)
    scheduleSyncPricesOnce_(source);
}

/**
 * 카페24 상품 캐시 증분 업데이트 (1시간 트리거 실행).
 * 기존 시트와 API 결과를 비교하여 신규 추가 / 삭제된 항목만 반영.
 * 시트 없으면 initCafe24Cache() 위임.
 */
function buildCafe24Cache() {
    const source = resolveExecutionSource_('AUTO');
    const ss = getSpreadsheet();
    const cfg = readConfig(ss);
    G_CFG = cfg;
    G_SS = ss;
    initMonitoringSheet_(G_CFG);  // 모니터링 시트(monitoring-gas 갱신 담당)에서 최신 토큰 로드
    G_TOKEN = G_CFG[KEY.C24_ACCESS_TOKEN] || '';
    checkMonitoringTokenState_(G_CFG, 'buildCafe24Cache');

    const mallId = cfg[KEY.C24_MALL_ID];
    const apiVer = cfg[KEY.C24_API_VERSION] || '2025-12-01';
    const limit = 100;
    const header = ['product_no', 'product_code', 'product_name', 'custom_variant_code', 'variant_code', 'additional_amount'];

    // 기존 시트 로드
    const sh = ss.getSheetByName('카페24상품');
    if (!sh) {
        Logger.log('[buildCafe24Cache] [카페24상품] 시트 없음 → initCafe24Cache() 실행');
        initCafe24Cache();
        return;
    }

    const existingData = sh.getDataRange().getValues();
    // custom_variant_code + product_no + variant_code → 행 데이터
    // 동일 custom_variant_code가 여러 상품/옵션에 존재할 수 있으므로 복합키로 구분한다.
    const makeRowKey = row => [
        String(row[3] || '').trim(),
        String(row[0] || '').trim(),
        String(row[4] || '').trim(),
    ].join('\u001f');
    const normalizeRow = row => [
        String(row[0] || '').trim(),
        String(row[1] || '').trim(),
        String(row[2] || ''),
        String(row[3] || '').trim(),
        String(row[4] || '').trim(),
        parseFloat(String(row[5] || '0').replace(/,/g, '')) || 0,
    ];
    const rowsEqual = (left, right) => {
        const a = normalizeRow(left);
        const b = normalizeRow(right);
        return a.every((value, index) => value === b[index]);
    };
    const existingMap = new Map();
    for (let i = 1; i < existingData.length; i++) {
        const row = existingData[i];
        const code = String(row[3] || '').trim();
        const productNo = String(row[0] || '').trim();
        const variantCode = String(row[4] || '').trim();
        if (code && productNo && variantCode) existingMap.set(makeRowKey(row), row);
    }

    // API 전체 조회
    let offset = 0;
    const apiMap = new Map();
    while (true) {
        const products = fetchCafe24ProductsPage_(mallId, apiVer, offset, limit);
        if (!products) break;
        for (const product of products) {
            const productNo = String(product.product_no || '');
            const productCode = String(product.product_code || '');
            const productName = String(product.product_name || '');
            if (!productNo) continue;
            const variants = product.variants || [];
            for (const v of variants) {
                const customCode = String(v.custom_variant_code || '').trim();
                if (!customCode) continue;
                const variantCode = String(v.variant_code || '').trim();
                const price = parseFloat(String(v.additional_amount || '0').replace(/,/g, '')) || 0;
                const row = [productNo, productCode, productName, customCode, variantCode, price];
                apiMap.set(makeRowKey(row), row);
            }
        }
        if (products.length < limit) break;
        offset += limit;
    }

    // 비교: 신규 추가 / 삭제 / 기존 행의 필드 변경
    const toAdd = [];
    const toUpdate = [];
    for (const [key, row] of apiMap) {
        if (!existingMap.has(key)) {
            toAdd.push(row);
        } else if (!rowsEqual(existingMap.get(key), row)) {
            toUpdate.push(row);
        }
    }

    const toRemove = new Set();
    for (const key of existingMap.keys()) {
        if (!apiMap.has(key)) toRemove.add(key);
    }

    // 변경이 있으면 최신 API 결과로 전체 행을 재구성한다.
    // G열 PROD_DES가 있으면 custom_variant_code 기준으로 보존한다.
    if (toAdd.length > 0 || toUpdate.length > 0 || toRemove.size > 0) {
        const hasDescriptionColumn = existingData.some(row => row.length > header.length);
        const descriptionByCode = new Map();
        if (hasDescriptionColumn) {
            for (let i = 1; i < existingData.length; i++) {
                const code = String(existingData[i][3] || '').trim();
                const description = existingData[i][6];
                if (code && description !== '' && description != null) {
                    descriptionByCode.set(code, description);
                }
            }
        }
        const outputHeader = hasDescriptionColumn ? header.concat([existingData[0][6] || '']) : header;
        const outputRows = Array.from(apiMap.values()).map(row => {
            if (!hasDescriptionColumn) return row;
            return row.concat([descriptionByCode.get(String(row[3] || '').trim()) || '']);
        });
        sh.clearContents();
        sh.getRange(1, 1, 1, outputHeader.length).setValues([outputHeader]);
        if (outputRows.length > 0) {
            sh.getRange(2, 1, outputRows.length, outputHeader.length).setValues(outputRows);
        }
    }

    Logger.log(`[buildCafe24Cache] ✅ 증분 완료 — 신규 추가 ${toAdd.length}건 / 변경 ${toUpdate.length}건 / 삭제 ${toRemove.size}건 / 기존 ${existingMap.size}건`);

    // syncPrices one-time 트리거 예약 (10분 후)
    scheduleSyncPricesOnce_(source);
}

/** 카페24 상품 목록 페이지 조회 (판매함만) */
function fetchCafe24ProductsPage_(mallId, apiVersion, offset, limit) {
    const url = `https://${mallId}.cafe24api.com/api/v2/admin/products?limit=${limit}&offset=${offset}&selling=T&fields=product_no,product_code,product_name,variants&embed=variants`;
    const res = c24Get(url, apiVersion);
    if (!res.ok) {
        Logger.log('상품 목록 조회 오류: ' + res.status + ' ' + res.body.substring(0, 100));
        return null;
    }
    return JSON.parse(res.body).products || [];
}

function debugCafe24First() {
    const ss = getSpreadsheet();
    const cfg = readConfig(ss);
    G_CFG = cfg;
    G_SS = ss;
    initMonitoringSheet_(G_CFG);
    G_TOKEN = G_CFG[KEY.C24_ACCESS_TOKEN] || '';
    checkMonitoringTokenState_(G_CFG, 'debugCafe24First');

    const mallId = cfg[KEY.C24_MALL_ID];
    const apiVer = cfg[KEY.C24_API_VERSION] || '2025-12-01';
    const products = fetchCafe24ProductsPage_(mallId, apiVer, 0, 1) || [];
    const first = products[0] || {};
    const variants = first.variants;
    Logger.log('[debugCafe24First] variants: ' + (Array.isArray(variants) ? variants.length + '건' : String(variants)));
    if (Array.isArray(variants) && variants.length > 0) {
        Logger.log('[debugCafe24First] first variant keys: ' + Object.keys(variants[0]).join(','));
        Logger.log('[debugCafe24First] first variant raw: ' + JSON.stringify(variants[0]));
    }
}

/** 특정 상품의 variants 조회 — 재시도 포함, 오류 시 스킵 */
function fetchProductVariants(mallId, apiVersion, productNo) {
    const url = `https://${mallId}.cafe24api.com/api/v2/admin/products/${productNo}/variants?fields=variant_code,custom_variant_code,additional_amount`;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const res = UrlFetchApp.fetch(url, {
                method: 'GET',
                headers: { Authorization: `Bearer ${G_TOKEN}`, 'X-Cafe24-Api-Version': apiVersion },
                muteHttpExceptions: true,
                validateHttpsCertificates: false,
            });
            const status = res.getResponseCode();
            const body = res.getContentText();
            if (status === 429) { Logger.log(`429, 15s 대기 (product=${productNo})`); Utilities.sleep(15000); continue; }
            if (status === 401 && attempt === 1) {
                reloadMonitoringTokenOrThrow_('fetchProductVariants 최초 401');
                continue;
            }
            if (status === 401) {
                throwAuthFailure_('fetchProductVariants 재시도 401', 'monitoring-gas 최신 토큰도 거부됨');
            }
            if (status < 200 || status >= 300) {
                Logger.log(`Variants 오류 (attempt=${attempt}): product=${productNo} status=${status}`);
                if (attempt < 2) { Utilities.sleep(3000); continue; }
                return [];
            }
            return JSON.parse(body).variants || [];
        } catch (e) {
            if (isAuthFailure_(e)) throw e;
            Logger.log(`Variants 네트워크 오류 (attempt=${attempt}): product=${productNo} | ${e.message}`);
            if (attempt < 2) { Utilities.sleep(5000); } else { return []; }
        }
    }
    return [];
}


// ════════════════════════════════════════════════════════
// ■ 이카운트 API
// ════════════════════════════════════════════════════════

function ecLogin(cfg) {
    const zone = cfg[KEY.EC_ZONE];
    const baseUrl = cfg[KEY.EC_ZONE_URL];
    const finalUrl = baseUrl.replace(/(sboapi|oapi)/, '$1' + zone) + '/OAPI/V2/OAPILogin';
    Logger.log('이카운트 로그인 URL: ' + finalUrl);
    const res = post(finalUrl, {
        COM_CODE: cfg[KEY.EC_COM_CODE], USER_ID: cfg[KEY.EC_USER_ID],
        API_CERT_KEY: cfg[KEY.EC_CERT_KEY], LAN_TYPE: 'ko-KR', ZONE: zone,
    });
    const sid = res?.Data?.Datas?.SESSION_ID || res?.Data?.SESSION_ID;
    if (!sid) throw new Error('이카운트 로그인 실패: ' + JSON.stringify(res));
    Logger.log('이카운트 로그인 성공. SESSION_ID=' + sid.substring(0, 8) + '...');
    return sid;
}

function fetchEcountPrices(cfg, sessionId) {
    const zone = cfg[KEY.EC_ZONE];
    const baseUrl = cfg[KEY.EC_ZONE_URL];
    const priceField = cfg[KEY.EC_PRICE_FIELD] || 'OUT_PRICE2';
    const url = baseUrl.replace(/(sboapi|oapi)/, '$1' + zone) +
        `/OAPI/V2/InventoryBasic/GetBasicProductsList?SESSION_ID=${sessionId}`;
    const res = post(url, {});
    const items = res?.Data?.Result ?? [];
    const map = {};
    const descMap = {};
    for (const item of items) {
        const cd = String(item.PROD_CD || '');
        const des = String(item.PROD_DES || '');
        if (cd) {
            map[cd] = parseFloat(String(item[priceField] || '0').replace(/,/g, '')) || 0;
            descMap[cd] = des;
        }
    }
    return { prices: map, descriptions: descMap };
}

function post(url, payload) {
    const res = UrlFetchApp.fetch('http://115.68.228.60:3000/proxy', {
        method: 'POST', contentType: 'application/json',
        headers: { 'x-proxy-key': 'ecount2026proxy' },
        payload: JSON.stringify({ url: url, body: payload }), muteHttpExceptions: true,
    });
    return JSON.parse(res.getContentText());
}


// ════════════════════════════════════════════════════════
// ■ 구글 시트 유틸
// ════════════════════════════════════════════════════════

function getSpreadsheet() {
    try { return SpreadsheetApp.getActiveSpreadsheet(); }
    catch (e) { return SpreadsheetApp.openById(SPREADSHEET_ID); }
}

/**
 * 모니터링 시트 초기화.
 * 메인 [설정]의 MONITORING_SHEET_ID로 모니터링 시트를 열고,
 * 해당 시트 [설정]의 토큰 4개 키를 cfg에 오버레이한다.
 */
function initMonitoringSheet_(cfg) {
    const monId = cfg[KEY.MONITORING_SHEET_ID];
    if (!monId) {
        throwAuthFailure_('initMonitoringSheet', 'MONITORING_SHEET_ID 누락');
    }
    try {
        G_MON_SS = SpreadsheetApp.openById(monId);
        const monCfg = readConfig(G_MON_SS);
        if (!monCfg[KEY.C24_ACCESS_TOKEN]) {
            throwAuthFailure_('initMonitoringSheet', 'monitoring-gas access token 없음');
        }
        [KEY.C24_ACCESS_TOKEN, KEY.C24_REFRESH_TOKEN, KEY.TOKEN_EXPIRES_AT, KEY.REFRESH_EXPIRES_AT]
            .forEach(k => { if (monCfg[k]) cfg[k] = monCfg[k]; });
        Logger.log('[initMonitoringSheet] 모니터링 시트 토큰 로드 완료');
        const mainClientId = (G_SS ? readConfig(G_SS)[KEY.C24_CLIENT_ID] : '') || '(없음)';
        const monClientId  = monCfg[KEY.C24_CLIENT_ID] || '(없음)';
        Logger.log('[initMonitoringSheet] CLIENT_ID 매핑테이블: ' + mainClientId);
        Logger.log('[initMonitoringSheet] CLIENT_ID 모니터링  : ' + monClientId);
        Logger.log('[initMonitoringSheet] CLIENT_ID 일치여부  : ' + (mainClientId === monClientId));
    } catch (e) {
        if (isAuthFailure_(e)) throw e;
        throwAuthFailure_('initMonitoringSheet', 'monitoring-gas 시트 열기 실패: ' + e.message);
    }
}

function readConfig(ss) {
    const sh = ss.getSheetByName(SH.CONFIG);
    if (!sh) throw new Error('[설정] 시트 없음');
    const cfg = {};
    for (const row of sh.getDataRange().getValues()) {
        if (row[0]) cfg[String(row[0]).trim()] = String(row[1] ?? '').trim();
    }
    return cfg;
}

function setConfig(ss, key, value) {
    const sh = ss.getSheetByName(SH.CONFIG);
    if (!sh) return;
    const data = sh.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim() === key) {
            sh.getRange(i + 1, 2).setValue(value);
            SpreadsheetApp.flush();
            return;
        }
    }
}

/**
 * [카페24상품] 시트 G열에 이카운트 PROD_DES 저장
 * 매칭 기준: D열 custom_variant_code == 이카운트 PROD_CD
 * A~F열은 건드리지 않음
 */
function writeProdDesToCafe24Sheet_(ss, ecDescriptions) {
    if (!ss || !ecDescriptions) return;
    const sh = ss.getSheetByName('카페24상품');
    if (!sh) return;
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return;

    const codeRange = sh.getRange(2, 4, lastRow - 1, 1); // D열 custom_variant_code
    const desRange = sh.getRange(2, 7, lastRow - 1, 1);  // G열 PROD_DES
    const codes = codeRange.getValues();
    const existing = desRange.getValues();

    const updates = codes.map((row, idx) => {
        const code = String(row[0] || '').trim();
        if (code && ecDescriptions[code]) {
            return [ecDescriptions[code]];
        }
        return [existing[idx] ? existing[idx][0] : ''];
    });

    desRange.setValues(updates);
}

/**
 * [매핑테이블] 시트 읽기
 * 헤더: custom_variant_code | product_no | variant_code | ecount_price_vat | 최근업데이트 | 결과
 * @returns {{ [customCode]: { productNo, variantCode } }}
 */
function readMappingTable(ss) {
    const sh = ss.getSheetByName(SH.MAPPING);
    const cache = {};
    if (!sh) return cache;
    const data = sh.getDataRange().getValues();
    if (data.length <= 1) return cache;
    for (let i = 1; i < data.length; i++) {
        const code = String(data[i][0] || '').trim();
        const productNo = String(data[i][1] || '').trim();
        const varCode = String(data[i][2] || '').trim();
        if (code && productNo) {
            cache[code] = { productNo, variantCode: varCode };
        }
    }
    return cache;
}

/** [매핑테이블] 시트 전체 갱신 */
function writeMappingTable(ss, rows) {
    const sh = ss.getSheetByName(SH.MAPPING);
    if (!sh) { Logger.log('⚠️ [매핑테이블] 시트 없음'); return; }
    const header = ['custom_variant_code', 'product_no', 'variant_code', 'ecount_price_vat', '최근업데이트', '결과'];
    sh.clearContents();
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    if (rows.length > 0) {
        sh.getRange(2, 1, rows.length, header.length).setValues(rows);
        sh.getRange(2, 4, rows.length, 1).setNumberFormat('0'); // D열 ecount_price_vat 숫자 서식
    }
}

/** [실행로그] 시트에 행 추가 */

/** [미매핑] 시트 기록 */
function writeUnmappedSheet(ss, rows) {
    let sh = ss.getSheetByName('미매핑');
    if (!sh) sh = ss.insertSheet('미매핑');
    const header = ['ecount_prod_cd', 'ecount_prod_des', '날짜'];
    if (sh.getLastRow() === 0) {
        sh.getRange(1, 1, 1, header.length).setValues([header]);
    }
    if (rows.length > 0) {
        const startRow = sh.getLastRow() + 1;
        sh.getRange(startRow, 1, rows.length, header.length).setValues(rows);
    }
}

function writeLog(ss, start, source, updated, skipped, errors, detail) {
    const sh = ss.getSheetByName(SH.LOG);
    if (!sh) return;
    ensureLogSheetHeader_(sh);
    sh.appendRow([
        Utilities.formatDate(start, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
        source,
        updated, skipped, errors, detail,
    ]);
}

function ensureLogSheetHeader_(sh) {
    const header = ['실행시간', '실행출처', '업데이트', '스킵', '오류', '비고'];
    const row1 = sh.getRange(1, 1, 1, header.length).getValues()[0];
    const current = row1.map((v) => String(v || '').trim());
    if (current.join('|') !== header.join('|')) {
        sh.getRange(1, 1, 1, header.length).setValues([header]);
    }
}

function fixMissingSheet() {
    const ss = SpreadsheetApp.openById('1_T_pl2ItqfmdAsDmrjkg1BBZyQMAVXkUrPMEwhGI6ek');
    const sheet = ss.getSheetByName('미매핑');
    if (!sheet) throw new Error('[미매핑] 시트를 찾을 수 없습니다.');
    const lastRow = sheet.getLastRow();
    Logger.log('실제 데이터 행 수: ' + lastRow);
    if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, 3).clearContent();
    }
    const maxRows = sheet.getMaxRows();
    if (maxRows > 10) {
        sheet.deleteRows(10, maxRows - 10);
    }
    Logger.log('정리 완료. 현재 행수: ' + sheet.getMaxRows());
}


// syncPrices 진행 상태 저장
function getSyncProgress_() {
    const props = PropertiesService.getScriptProperties();
    return parseInt(props.getProperty(PROP.SYNC_PROGRESS_IDX) || '0', 10);
}
function setSyncProgress_(idx) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(PROP.SYNC_PROGRESS_IDX, String(idx));
}
function clearSyncProgress_() {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty(PROP.SYNC_PROGRESS_IDX);
}

function markSyncExecuted_(start) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(PROP.LAST_SYNC_AT, start.toISOString());
}

function resolveExecutionSource_(defaultSource) {
    if (G_EXEC_SOURCE === 'MANUAL') return 'MANUAL';
    if (G_EXEC_SOURCE === 'AUTO') return 'AUTO';
    return defaultSource;
}

function setNextSyncSource_(source) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(PROP.NEXT_SYNC_SOURCE, source);
}

function consumeSyncExecutionSource_() {
    const props = PropertiesService.getScriptProperties();
    const pending = props.getProperty(PROP.NEXT_SYNC_SOURCE);
    if (pending) {
        props.deleteProperty(PROP.NEXT_SYNC_SOURCE);
        return pending;
    }
    return resolveExecutionSource_('AUTO');
}

function getLastSyncAt_() {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty(PROP.LAST_SYNC_AT);
    if (!raw) return null;

    const dt = new Date(raw);
    return isNaN(dt.getTime()) ? null : dt;
}

function now() {
    return Utilities.formatDate(new Date(), 'Asia/Seoul', 'HH:mm:ss');
}

// 장애 알림 메일 (ADMIN_EMAIL)
function notifyAdmin_(cfg, message) {
    if (!cfg) return;
    const email = cfg[KEY.ADMIN_EMAIL];
    if (!email) return;
    try {
        MailApp.sendEmail(email, '[Ecount-Cafe24] 동기화 장애 알림', message);
    } catch (e) {
        Logger.log('[notifyAdmin] 메일 발송 실패: ' + e.message);
    }
}

function isAuthFailure_(e) {
    return !!e && String(e.message || e).startsWith('[AUTH_401]');
}

function throwAuthFailure_(context, detail) {
    const message = `[AUTH_401] ${context}: ${detail}`;
    Logger.log(message);
    if (!G_AUTH_ALERT_SENT) {
        G_AUTH_ALERT_SENT = true;
        notifyAdmin_(G_CFG, `gas-push 인증 중단\n${context}\n${detail}\nmonitoring-gas 토큰 상태를 확인하세요.`);
    }
    throw new Error(message);
}

// monitoring-gas가 제공한 토큰의 존재 여부와 만료 상태만 검사한다.
function checkMonitoringTokenState_(cfg, context) {
    if (!cfg || !cfg[KEY.C24_ACCESS_TOKEN]) {
        throwAuthFailure_(context, 'monitoring-gas access token 없음');
    }

    const accessExp = cfg[KEY.TOKEN_EXPIRES_AT];
    if (!accessExp) {
        throwAuthFailure_(context, 'monitoring-gas access token 만료 시각 없음');
    }

    const accessDt = new Date(String(accessExp));
    if (isNaN(accessDt.getTime())) {
        throwAuthFailure_(context, 'monitoring-gas access token 만료 시각 형식 오류');
    }
    if (accessDt.getTime() <= Date.now()) {
        throwAuthFailure_(context, `monitoring-gas access token 만료됨 (${accessExp})`);
    }

    const refreshExp = cfg[KEY.REFRESH_EXPIRES_AT];
    if (refreshExp) {
        const refreshDt = new Date(String(refreshExp));
        if (!isNaN(refreshDt.getTime())) {
            const daysLeft = Math.ceil((refreshDt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (daysLeft === 7) {
                notifyAdmin_(cfg, `Refresh token 만료 7일 전 경고: (${refreshExp})\n재인증 준비 필요`);
            }
            if (daysLeft <= 0) {
                throwAuthFailure_(context, `monitoring-gas refresh token 만료됨 (${refreshExp})`);
            }
        }
    }

    Logger.log(`[TokenCheck] ${context}: monitoring-gas access token 사용 가능`);
}

// 테스트 알림 메일 발송
function testAdminEmail() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cfg = readConfig(ss);
    notifyAdmin_(cfg, '테스트 알림: 이메일 발송 확인용 메시지입니다.');
    Logger.log('테스트 알림 발송 완료');
}

// 설정 시트에 토큰 만료 키 추가/보정
function ensureTokenExpiryKeys() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SH.CONFIG);
    if (!sh) { Logger.log('[ensureTokenExpiryKeys] 설정 시트 없음'); return; }
    const data = sh.getDataRange().getValues();
    const keys = data.map(r => String(r[0] || '').trim());

    const ensureRow = (key) => {
        if (keys.includes(key)) return;
        sh.appendRow([key, '']);
        keys.push(key);
    };

    ensureRow(KEY.TOKEN_EXPIRES_AT);
    ensureRow(KEY.REFRESH_EXPIRES_AT);
    Logger.log('[ensureTokenExpiryKeys] TOKEN_EXPIRES_AT/REFRESH_EXPIRES_AT 추가 완료');
}

// 특정 품목의 가격 비교 로그 출력 (매핑테이블)
function printPriceCheck() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('매핑테이블');
    if (!sh) { Logger.log('[printPriceCheck] 매핑테이블 시트 없음'); return; }
    const data = sh.getDataRange().getValues();
    if (data.length <= 1) { Logger.log('[printPriceCheck] 데이터 없음'); return; }
    const header = data[0].map(h => String(h || ''));
    const norm = s => s.toLowerCase().replace(/\s+/g, '');
    const headerNorm = header.map(norm);

    const findIdx = (candidates) => {
        for (const c of candidates) {
            const i = headerNorm.indexOf(norm(c));
            if (i >= 0) return i;
        }
        return -1;
    };

    const idxCode = findIdx(['ecount_prod_cd', 'prod_cd', '품목코드', '이카운트품목코드']);
    const idxOut = findIdx(['ecount_out_price2', 'out_price2', '2단가', '이카운트_2단가']);
    const idxPrev = findIdx(['ecount_prev_price', 'prev_price', '이전단가', '이전가격']);

    if (idxCode < 0 || idxOut < 0 || idxPrev < 0) {
        Logger.log('[printPriceCheck] 컬럼 인덱스 찾기 실패');
        Logger.log('[printPriceCheck] 헤더: ' + header.join(' | '));
        return;
    }

    for (let i = 1; i < data.length; i++) {
        if (String(data[i][idxCode]).trim() === '(1)200자이02방수936') {
            const out = data[i][idxOut];
            const prev = data[i][idxPrev];
            Logger.log(`out_price2=${out}, prev_price=${prev}, 동일여부=${String(out) === String(prev)}`);
            return;
        }
    }
    Logger.log('[printPriceCheck] 대상 코드 없음: (1)200자이02방수936');
}

// 특정 품목의 ecount_price_vat 출력 (매핑테이블)
function printCachedPrice() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('매핑테이블');
    if (!sh) { Logger.log('[printCachedPrice] 매핑테이블 시트 없음'); return; }
    const data = sh.getDataRange().getValues();
    if (data.length <= 1) { Logger.log('[printCachedPrice] 데이터 없음'); return; }

    const header = data[0].map(h => String(h || ''));
    const idxCode = header.indexOf('custom_variant_code');
    const idxVat = header.indexOf('ecount_price_vat');

    if (idxCode < 0 || idxVat < 0) {
        Logger.log('[printCachedPrice] 컬럼 인덱스 찾기 실패');
        Logger.log('[printCachedPrice] 헤더: ' + header.join(' | '));
        return;
    }

    for (let i = 1; i < data.length; i++) {
        if (String(data[i][idxCode]).trim() === '(1)200자이02방수936') {
            Logger.log(`ecount_price_vat=${data[i][idxVat]}`);
            return;
        }
    }
    Logger.log('[printCachedPrice] 대상 코드 없음: (1)200자이02방수936');
}


// ════════════════════════════════════════════════════════
// ■ 보조 함수: custom_variant_code 일괄 등록
// ════════════════════════════════════════════════════════

/**
 * [보조매핑] 시트의 데이터를 읽어 카페24 variants에 custom_variant_code를 등록.
 * 시트 컬럼: A=ecount_prod_cd | B=cafe24_product_no
 *
 * 실행 조건:
 *   1. [보조매핑] 시트가 구글 시트에 존재해야 함 (populateRepairSheet 실행 후)
 *   2. GAS 에디터에서 setCustomVariantCodes() 를 1회만 실행.
 */
function setCustomVariantCodes() {
    const ss = getSpreadsheet();
    const cfg = readConfig(ss);
    G_CFG = cfg;
    G_SS = ss;
    initMonitoringSheet_(G_CFG);
    G_TOKEN = G_CFG[KEY.C24_ACCESS_TOKEN] || '';
    checkMonitoringTokenState_(G_CFG, 'setCustomVariantCodes');

    const sh = ss.getSheetByName('보조매핑');
    if (!sh) throw new Error('[보조매핑] 시트 없음. populateRepairSheet()를 먼저 실행하세요.');

    const data = sh.getDataRange().getValues();
    const mallId = cfg[KEY.C24_MALL_ID];
    const apiVer = cfg[KEY.C24_API_VERSION] || '2025-12-01';

    let done = 0, skipped = 0, errors = 0;

    for (let i = 1; i < data.length; i++) {  // 1행부터 (0=헤더)
        const prodCd = String(data[i][0] || '').trim();
        const productNo = String(data[i][1] || '').trim();
        if (!prodCd || !productNo) continue;

        // variants 조회
        const variantsUrl = `https://${mallId}.cafe24api.com/api/v2/admin/products/${productNo}/variants?fields=variant_code,custom_variant_code`;
        const vRes = c24Get(variantsUrl, apiVer);
        if (!vRes.ok) {
            Logger.log(`[${i}/${data.length - 1}] 조회실패: ${prodCd} | status=${vRes.status}`);
            errors++;
            continue;
        }
        const variants = JSON.parse(vRes.body).variants || [];
        if (variants.length === 0) {
            Logger.log(`[${i}] variant 없음: ${prodCd}`);
            skipped++;
            continue;
        }

        // 첫 번째 variant에 custom_variant_code 설정
        const v = variants[0];
        const existingCode = String(v.custom_variant_code || '').trim();

        if (existingCode && existingCode !== prodCd) {
            // 이미 다른 코드가 있으면 스킵
            Logger.log(`[${i}] 스킵 (이미 설정됨: "${existingCode}"): ${prodCd}`);
            skipped++;
            continue;
        }
        if (existingCode === prodCd) {
            Logger.log(`[${i}] 이미 일치: ${prodCd}`);
            skipped++;
            continue;
        }

        // PUT으로 custom_variant_code 등록
        const putUrl = `https://${mallId}.cafe24api.com/api/v2/admin/products/${productNo}/variants/${v.variant_code}`;
        const putRes = c24Put(putUrl, apiVer, {
            shop_no: 1,
            request: { custom_variant_code: prodCd },
        });

        if (putRes.ok) {
            Logger.log(`[${i}/${data.length - 1}] ✅ 등록: ${prodCd} → variant=${v.variant_code}`);
            done++;
        } else {
            Logger.log(`[${i}] ❌ 실패 (${putRes.status}): ${prodCd} | ${putRes.body.substring(0, 80)}`);
            errors++;
        }

        Utilities.sleep(600);
    }

    Logger.log(`\n완료 — 등록:${done} 스킵:${skipped} 오류:${errors}`);
}

/**
 * [보조매핑] 시트에 601건 데이터를 기록 (1회 실행).
 * 이후 setCustomVariantCodes() 를 실행하면 됩니다.
 */
function populateRepairSheet() {
    const ss = getSpreadsheet();
    let sh = ss.getSheetByName('보조매핑');
    if (!sh) sh = ss.insertSheet('보조매핑');
    sh.clearContents();

    // 헤더
    sh.getRange(1, 1, 1, 2).setValues([['ecount_prod_cd', 'cafe24_product_no']]);

    // 601건 매핑 데이터 (이카운트 PROD_CD → 카페24 product_no)
    // Python으로 생성된 variant_code_repair_map.json 기반
    const MAP_DATA = { "(1)100구조재A14": "1674", "(1)100구조재A16": "1675", "(1)100구조재A18": "1676", "(1)100구조재B110": "1677", "(1)100구조재B112": "1678", "(1)100구조재C22": "1679", "(1)100구조재C24": "1680", "(1)100구조재C26": "1681", "(1)100구조재C28": "1682", "(1)100구조재D212": "1684", "(1)100구조재E70각": "836", "(1)100구조재E90각": "896", "(1)100라왕301400원": "1801", "(1)100라왕심재": "1617", "(1)100라왕한치각": "1616", "(1)100라왕후지": "1618", "(1)100목망꽃바둑1015": "1403", "(1)100목망캡": "1107", "(1)100미송루바8자": "839", "(1)100방부목1120": "1000", "(1)100방부목295": "1000", "(1)100방부목3140": "1000", "(1)100방부목4A22": "1659", "(1)100방부목524": "1660", "(1)100방부목626": "1661", "(1)100방부목8212": "1664", "(1)100방부목91라티": "1177", "(1)100방부목944": "1665", "(1)100방킬8자": "877", "(1)100소송1303012": "1613", "(1)100소송2306912": "1614", "(1)100소송330308": "1611", "(1)100소송4203012": "1615", "(1)100소송53030121": "1614", "(1)100소송63069121": "1614", "(1)100자나무": "975", "(1)100편백루바18유": "1317", "(1)100편백루바8무": "1317", "(1)200A자이01일반93": "1415", "(1)200국산2차음1236": "1622", "(1)200자이02방수936": "1416", "(1)200자이03방화1236": "811", "(1)200자이04일반1236": "1552", "(1)200자이05일반938": "1415", "(1)200하국산방화1236": "1621", "(1)201CRC636": "1164", "(1)201CRC936": "1164", "(1)201석고텍스KCC": "1379", "(1)3001A2748BB": "1604", "(1)3001B448오징": "936", "(1)3001C4648BB": "1604", "(1)3001D4648알": "936", "(1)3001E8548BB": "1604", "(1)3001F8548MLH": "936", "(1)3001G38548콤": "1641", "(1)3001H11548BB": "1604", "(1)3001I11548MLH": "936", "(1)3001J11548콤": "1641", "(1)3001K11548다": "1642", "(1)3001L14548BB": "1604", "(1)3001M17548BB": "1604", "(1)3001Y코아18알": "787", "(1)3001Z코아18라": "787", "(1)300A12736B": "1371", "(1)300A1자작SBB4": "1604", "(1)300A24636B": "1371", "(1)300A2자작SBB6": "1604", "(1)300A38536B": "1371", "(1)300A3자작SBB9": "1604", "(1)300A48536알": "1371", "(1)300A4자작SBB12": "1604", "(1)300A511536B": "1371", "(1)300A5자작SBB15": "1604", "(1)300A611536M": "1371", "(1)300A6자작SBB18": "1604", "(1)300B1미송유48": "783", "(1)300B2미송유85": "783", "(1)300B3미송유12": "783", "(1)300B4미송유15": "783", "(1)300B5미송유18": "783", "(1)300B6미송무45": "959", "(1)300C1낙엽48": "852", "(1)300C2낙엽75": "852", "(1)300C3낙엽115": "852", "(1)300E낙엽18": "852", "(1)300OSB11내": "1565", "(1)300OSB8내": "1565", "(1)300내수1248수": "1018", "(1)300내수21236수": "833", "(1)300백색27": "1015", "(1)300오크27": "936", "(1)300준내수948": "1018", "(1)300태고1248N": "1638", "(1)300태고21236": "833", "(1)301MDF113고밀": "781", "(1)301MDF1245고밀": "781", "(1)301MDF136USB": "781", "(1)301MDF149USB": "781", "(1)301MDF1512USB": "781", "(1)301MDF1615USB": "781", "(1)301MDF1718USB": "781", "(1)301MDF1825UB": "781", "(1)301MDF1930UB": "781", "(1)301MDF206고밀": "1672", "(1)301MDF209고밀": "1672", "(1)301MDF2112고밀": "1672", "(1)301MDF2215고밀": "1672", "(1)301MDF2318고밀": "1672", "(1)302고무12탑": "960", "(1)302고무15탑": "960", "(1)302고무18탑": "960", "(1)302라디12탑": "1655", "(1)302라디15탑": "1655", "(1)302라디18탑": "1655", "(1)302라디24탑": "1655", "(1)302라디30탑": "1655", "(1)302레드12솔": "1801", "(1)302레드15솔": "1801", "(1)302레드18솔": "1801", "(1)302레드60각": "1795", "(1)302멀바1238": "1814", "(1)302멀바1538": "1814", "(1)302멀바1838": "1814", "(1)302멀바1848": "1739", "(1)302멀바계단30300": "927", "(1)302멀바계단38300": "1733", "(1)302미송계단38300": "1733", "(1)302미송대봉9090": "1650", "(1)302미송반달4070": "1284", "(1)302미송소봉4040": "1287", "(1)302미송식빵6070": "1289", "(1)302삼목12솔": "1811", "(1)302삼목15솔": "1811", "(1)302삼목18솔": "1811", "(1)302쏘노30300": "920", "(1)302아카15유": "1772", "(1)302아카18N무": "1776", "(1)302아카18유": "1772", "(1)302에쉬1848": "1645", "(1)302오동12솔": "1174", "(1)500다크브201328": "956", "(1)500도장피스838": "1380", "(1)500미들클립20": "1402", "(1)500스타트클립20": "1865", "(1)500아티론": "869", "(1)500클립피스820": "842", "(1)502백스페": "875", "(1)503스카이비바": "1231", "(1)503차음시트기본": "1701", "(1)503타공라메9": "1228", "(1)503타공원메9": "1227", "(1)60010그라스울기본": "979", "(1)60011아이소101호": "1593", "(1)60011이보드13도배": "1596", "(1)60012아이소20특": "1593", "(1)60012이보드23도배": "1597", "(1)60013아이소30특": "1593", "(1)60013이보드33도배": "1598", "(1)60014아이소50특": "848", "(1)60015아이소100특": "848", "(1)6001열반사10양": "885", "(1)6001열반사6양": "885", "(1)6002열반사10양": "885", "(1)6002열반사6양": "885", "(1)600LXPF301800N": "1546", "(1)600LXPF501800N": "1547", "(1)600LXPF901800N": "1548", "(1)600이보드13페": "1599", "(1)600이보드23페": "1600", "(1)600이보드33페": "1601", "(1)700168401걸레": "1828", "(1)700AL앵글도장": "1692", "(1)700A합7351935": "933", "(1)700B합7352035": "933", "(1)700C합8352035": "933", "(1)700D합9352035": "933", "(1)700E합8002000무": "1563", "(1)700F합8002000유": "1563", "(1)700G합8002100무": "1563", "(1)700H합9002100무": "1589", "(1)700I합9002100유": "1589", "(1)700J합1102100다": "1618", "(1)700K합100800요": "1231", "(1)700L합110900요": "1231", "(1)700P마이너메지95": "1401", "(1)700메지도장95": "987", "(1)700영1162계단": "1398", "(1)700영116301걸레": "1825", "(1)700영116601걸레": "1829", "(1)700영11680020001": "1345", "(1)700영11680020002": "1345", "(1)700영11690021001": "1345", "(1)700영11690021002": "1345", "(1)700영116901걸레": "1830", "(1)700영116P마이너": "1832", "(1)700영116마이너": "1823", "(1)700영116문선": "1830", "(1)700영116시트": "1854", "(1)700영116엣지": "1830", "(1)700영116천정1": "1827", "(1)700영116천정2": "1398", "(1)700영116천정3": "1398", "(1)700영116코너중": "1398", "(1)700영116평100": "1827", "(1)700영116평120": "1827", "(1)700영116평160": "1826", "(1)700영116평200": "1827", "(1)700영116평250": "1827", "(1)700영116평30": "1824", "(1)700영116평300": "1824", "(1)700영116평40": "1822", "(1)700영116평60": "1826", "(1)700영116평80": "1827", "(1)700영116평문선": "1823", "(1)700영161시트": "1854", "(1)700영168301걸레": "1825", "(1)700영16890021002": "1350", "(1)700영168마이너": "1823", "(1)700영168엣지": "1823", "(1)700영168평30": "1824", "(1)700영168평40": "1822", "(1)700영168평60": "1826", "(1)700영169301걸레": "1825", "(1)700영169401걸레": "1828", "(1)700영16990021002": "1350", "(1)700영169마이너": "1823", "(1)700영169엣지": "1823", "(1)700영169평30": "1824", "(1)700영169평40": "1822", "(1)700영169평60": "1826", "(1)700영194301걸레": "1825", "(1)700영194401걸레": "1828", "(1)700영194마이너스": "1823", "(1)700영194평30": "1824", "(1)700영194평40": "1822", "(1)700영194평60": "1826", "(1)700영195301걸레": "1825", "(1)700영195401걸레": "1828", "(1)700영195엣지": "1823", "(1)700영2580020001": "1346", "(1)700영2580020002": "1346", "(1)700영2590021001": "1592", "(1)700영2590021002": "1592", "(1)700영25코너대": "1622", "(1)700영25코너소": "1238", "(1)700영2780020001": "1346", "(1)700영2780020002": "1346", "(1)700영2790021001": "1590", "(1)700영3480020002": "1347", "(1)700영402계단": "1336", "(1)700영403계단": "1238", "(1)700영4080020001": "1348", "(1)700영4080020002": "1348", "(1)700영4090021001": "1593", "(1)700영4090021002": "1593", "(1)700영40901걸레": "1830", "(1)700영40마이너": "1823", "(1)700영40문선": "1238", "(1)700영40엣지": "1238", "(1)700영40천정1": "1335", "(1)700영40천정2": "1336", "(1)700영40천정3": "1337", "(1)700영40코너30": "1824", "(1)700영40코너대": "1231", "(1)700영40코너소": "1822", "(1)700영40코너중": "1238", "(1)700영40평100": "1827", "(1)700영40평120": "1335", "(1)700영40평160": "1826", "(1)700영40평200": "1336", "(1)700영40평250": "1336", "(1)700영40평30": "1238", "(1)700영40평300": "1337", "(1)700영40평40": "1238", "(1)700영40평60": "1238", "(1)700영40평80": "1238", "(1)700영40필름M": "1854", "(1)700영5080020001": "979", "(1)700영5080020002": "979", "(1)700영5090021001": "1593", "(1)700영5090021002": "1593", "(1)700영50엣지": "1233", "(1)700영5380020001": "1827", "(1)700영5380020002": "1827", "(1)700영5390021001": "978", "(1)700영5390021002": "978", "(1)700영53시트": "1854", "(1)700영53엣지": "1237", "(1)700영PS170평40": "1822", "(1)700영P백2계단대": "1843", "(1)700영P백2계단소": "1843", "(1)700영더1167331935": "1341", "(1)700영더1167331960": "1341", "(1)700영더1167332060": "1341", "(1)700영더1168332035": "1342", "(1)700영더1168332060": "1342", "(1)700영더1688332060": "1342", "(1)700영더1698332060": "1342", "(1)700영더257331935": "1341", "(1)700영더258332035": "1342", "(1)700영더277331935": "1341", "(1)700영더278332060": "1342", "(1)700영더347331935": "1341", "(1)700영더348332035": "1342", "(1)700영더407331935": "1341", "(1)700영더408332035": "1342", "(1)700영더408332060": "1342", "(1)700영더537331935": "1341", "(1)700영더537331960": "1341", "(1)700영더538332035": "1342", "(1)700영더538332060": "1342", "(1)700영렉스31208": "1370", "(1)700영렉스31210": "1344", "(1)700영렉스31212": "1346", "(1)700영림P마이너": "1832", "(1)700예HP52130걸레": "1825", "(1)700예HP52140걸레": "1828", "(1)700예HP52230걸레": "1837", "(1)700예HP52240걸레": "1838", "(1)80011실리1투명": "964", "(1)80011이지경실": "912", "(1)80011일반경실": "1332", "(1)80011타카422J": "899", "(1)80012실리반투명": "861", "(1)80012이지경골": "912", "(1)80012일반경골": "1332", "(1)80013실리백색": "964", "(1)80013이지경블": "912", "(1)80013일반경블": "1332", "(1)80013총422": "902", "(1)80014영림이지실버": "912", "(1)80014영림일반실버": "1332", "(1)80014이지경백": "1536", "(1)80014피스톤422": "1810", "(1)800CAP44흑": "1665", "(1)800가위": "967", "(1)800고체연료": "1563", "(1)800골판지": "1864", "(1)800뎀핑레일실": "861", "(1)800레일2": "1210", "(1)800레일3": "1837", "(1)800로라미4": "1247", "(1)800마대80": "1400", "(1)800마대90": "1400", "(1)800마대PP": "1454", "(1)800매거양321": "1359", "(1)800매거양625": "1173", "(1)800매거양632": "1402", "(1)800매거양638": "1402", "(1)800매거외321": "1359", "(1)800매거외625": "1173", "(1)800매거외625코": "1359", "(1)800매거외632": "1402", "(1)800매거외638": "1402", "(1)800비닐대": "1703", "(1)800비닐소": "1593", "(1)800빗자루": "1604", "(1)800빠찌링기본": "1162", "(1)800빠찌링백색": "1425", "(1)800빠찌링스텐": "914", "(1)800사륜로라": "1210", "(1)800사포120": "1224", "(1)800사포220": "1110", "(1)800사포320": "1362", "(1)800사포A원형": "1166", "(1)800서랍레일300": "1289", "(1)800서랍레일350": "983", "(1)800서랍레일400": "1279", "(1)800서랍레일450": "1279", "(1)800서랍레일피스": "983", "(1)800석고본드": "1244", "(1)800스텐피스25": "914", "(1)800스텐피스32": "914", "(1)800스텐피스38": "914", "(1)800스텐피스50": "914", "(1)800스토퍼말굽": "1865", "(1)800스토퍼블랙": "1865", "(1)800스토퍼실버": "1865", "(1)800스톱바": "1400", "(1)800실1701GR": "1330", "(1)800실5000BK": "1860", "(1)800실5000GR": "1326", "(1)800실5000WT": "1861", "(1)800실5001BK": "1862", "(1)800실5001GR": "1327", "(1)800실5001WT": "1863", "(1)800실5100GR": "1328", "(1)800실5101GR": "1329", "(1)800실6401GR": "1331", "(1)800실리B1투명": "863", "(1)800실리B반투명": "863", "(1)800실리B백색": "863", "(1)800실리C백색": "864", "(1)800실리골드": "861", "(1)800실리밤색": "964", "(1)800실리아이보리": "861", "(1)800실리우드": "898", "(1)800실리체리": "964", "(1)800실리콘건": "861", "(1)800실리회색": "964", "(1)800실리흑색": "964", "(1)800실타615": "913", "(1)800실타618": "913", "(1)800실타625": "913", "(1)800실타630": "913", "(1)800쓰레받": "1239", "(1)800씽크경유15": "985", "(1)800씽크경유18": "985", "(1)800씽크경일15": "985", "(1)800씽크경일18": "985", "(1)800씽크경피스": "985", "(1)800아연피스25": "929", "(1)800아연피스32": "929", "(1)800아연피스38": "929", "(1)800아연피스50": "929", "(1)800아연피스65": "929", "(1)800아연피스75": "929", "(1)800아연피스90": "842", "(1)800액자레일2": "1425", "(1)800에어건": "902", "(1)800엘가이드": "1400", "(1)800오메가12": "1279", "(1)800오메가7": "1279", "(1)800오메가8": "1279", "(1)800오메가9": "1279", "(1)800오목손사각": "967", "(1)800오목손은": "967", "(1)800오목손타원": "967", "(1)800오일116투명": "1245", "(1)800오일135투명": "1683", "(1)800오일16도토리": "1245", "(1)800오일16밤색": "1245", "(1)800오일16월넛": "1245", "(1)800오일16코코넛": "1245", "(1)800오일16티크": "1245", "(1)800오일16흑단": "1245", "(1)800오일16흑색": "1245", "(1)800오일35다크오렌": "1245", "(1)800오일35도토리": "1417", "(1)800오일35레드와인": "1245", "(1)800오일35마호가니": "1414", "(1)800오일35밝은오크": "1245", "(1)800오일35밤색": "1245", "(1)800오일35살구색": "1245", "(1)800오일35연녹색": "1245", "(1)800오일35연밤색": "1245", "(1)800오일35월넛": "1245", "(1)800오일35자단": "1245", "(1)800오일35참나무": "825", "(1)800오일35체리": "861", "(1)800오일35코코넛": "1245", "(1)800오일35티크": "1245", "(1)800오일35화이트": "1499", "(1)800오일35황색": "1245", "(1)800오일35흑단": "1245", "(1)800오일35흑색": "1245", "(1)800윙스25": "988", "(1)800윙스252": "988", "(1)800윙스32": "988", "(1)800윙스38": "988", "(1)800윙스45": "988", "(1)800윙스55": "988", "(1)800유리다보": "967", "(1)800자유경3": "1855", "(1)800자유경4": "1855", "(1)800장갑1코팅R": "987", "(1)800장갑기능대": "987", "(1)800장갑기능소": "987", "(1)800장갑기능중": "987", "(1)800점검300": "1401", "(1)800점검400": "1401", "(1)800점검450": "1401", "(1)800점검600": "1401", "(1)800점검AL600": "1401", "(1)800점검PVC300": "1401", "(1)800점검PVC400": "1401", "(1)800점검PVC450": "1401", "(1)800점검PVC600": "1401", "(1)800접시13": "910", "(1)800접시25": "910", "(1)800접시32": "910", "(1)800접시38": "910", "(1)800접착205": "980", "(1)800접착777": "849", "(1)800접착G1원": "1242", "(1)800접착G2원": "1243", "(1)800접착G3원": "1244", "(1)800접착아이소": "848", "(1)800접착에폭4": "850", "(1)800접착에폭A10": "850", "(1)800접착프라1": "1244", "(1)800접착프라3": "1244", "(1)800줄자55국": "1851", "(1)800줄자55세": "1851", "(1)800줄자55타": "1842", "(1)800줄자75타": "842", "(1)800철기리30": "1703", "(1)800철기리32": "1683", "(1)800철기리33": "1683", "(1)800총1850A": "902", "(1)800총630R": "902", "(1)800총BN1664": "902", "(1)800총CT64": "902", "(1)800총F30": "902", "(1)800칼브럭625": "913", "(1)800칼브럭640": "1806", "(1)800칼브럭812": "1666", "(1)800칼브럭890": "1593", "(1)800캇타칼": "1642", "(1)800캇타칼고급": "1269", "(1)800캇타칼날": "1401", "(1)800콩피스816": "988", "(1)800타카1022J": "899", "(1)800타카1ST18": "1173", "(1)800타카1ST25": "1173", "(1)800타카1ST32": "1173", "(1)800타카1ST38": "1173", "(1)800타카1ST45": "1173", "(1)800타카1ST50": "1173", "(1)800타카1ST57": "1173", "(1)800타카1ST64": "1173", "(1)800타카416J": "899", "(1)800타카419J": "899", "(1)800타카DT50": "856", "(1)800타카DT64": "1180", "(1)800타카F15": "913", "(1)800타카F20": "1362", "(1)800타카F25": "1705", "(1)800타카F30": "1195", "(1)800타카F40": "1238", "(1)800타카F50": "1709", "(1)800타카FST15": "1173", "(1)800타카FST18": "1173", "(1)800타카FST25": "1173", "(1)800타카FST30": "1173", "(1)800타카JST18": "1704", "(1)800타카JST25": "1705", "(1)800타카JST32": "1706", "(1)800타카JST38": "1707", "(1)800타카JST45": "1708", "(1)800타카JST50": "1709", "(1)800타카JST64": "1710", "(1)800타카T50": "901", "(1)800타카T57": "1534", "(1)800타카T64": "1240", "(1)800테잎25은": "890", "(1)800테잎50은": "890", "(1)800테잎마스대": "1667", "(1)800테잎마스소": "1670", "(1)800테잎박스": "1865", "(1)800테잎청": "1865", "(1)800테잎커버2000": "1666", "(1)800테잎커버2700": "1666", "(1)800테잎커버900": "1666", "(1)800테잎플로": "838", "(1)800텐텐지": "1536", "(1)800톱날265대": "1614", "(1)800톱날300대": "1614", "(1)800톱날330대": "1612", "(1)800톱날A265타": "909", "(1)800톱날A300타": "1614", "(1)800톱날A330타": "1612", "(1)800톱대": "1856", "(1)800퍼티20": "842", "(1)800퍼티5": "1865", "(1)800평붓2": "908", "(1)800평붓3": "908", "(1)800평붓4": "908", "(1)800평붓5": "908", "(1)800플로3": "978", "(1)800피스다보": "967", "(1)800피스톤630": "913", "(1)800피스톤CT64": "1240", "(1)800피스톤F30": "1195", "(1)800하폼건월드1": "1819", "(1)800하폼건월드2": "1818", "(1)800하폼건월드3": "1821", "(1)800하폼건월드4": "1857", "(1)800하폼건월드5": "1858", "(1)800하폼건월드8": "857", "(1)800하폼건월드9": "1859", "(1)800하폼크리너": "859", "(1)800핫멜트1심": "1244", "(1)800핫멜트건": "845", "(1)800핫팩": "1243", "(1)800행가노출2": "1160", "(1)800행가레일2": "1400", "(1)800행가양댐30": "1353", "(1)800행가양댐50": "1846", "(1)800행가양댐80": "1846", "(1)800행가하부촉": "1400", "(1)800헤라대": "964", "(1)800헤라소": "964", "(1)800헤라중": "964", "(1)800호스10": "1414", "(1)800호스20": "1414", "(1)800호스30": "1414", "(1)800호차30": "1781", "(1)A100뉴송11317": "836", "(1)A100뉴송21727": "836", "(1)A100뉴송32727": "836" };

    const rows = Object.entries(MAP_DATA).map(([cd, pno]) => [cd, pno]);
    sh.getRange(2, 1, rows.length, 2).setValues(rows);
    Logger.log('✅ [보조매핑] 시트에 ' + rows.length + '건 기록 완료.');
}

function doPost(e) {
  Logger.log('doPost 시작');
  Logger.log('e: ' + JSON.stringify(e));
  
  try {
    var items;
    
    // form-encoded 방식 (application/x-www-form-urlencoded)
    if (e && e.parameter && e.parameter.items) {
      Logger.log('parameter.items 수신');
      items = JSON.parse(e.parameter.items);
    }
    // JSON 방식 (application/json) 폴백
    else if (e && e.postData && e.postData.contents) {
      Logger.log('postData.contents 수신');
      var parsed = JSON.parse(e.postData.contents);
      items = parsed.items;
    }
    else {
      Logger.log('입력값 없음: ' + JSON.stringify(e));
      return ContentService.createTextOutput(
        JSON.stringify({ result: 'error', message: '입력값 없음' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    Logger.log('items: ' + JSON.stringify(items));
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('시트1');
    
    if (!sheet) {
      return ContentService.createTextOutput(
        JSON.stringify({ result: 'error', message: '시트1 없음' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var row = new Array(28).fill('');
      row[2] = today;
      row[4] = '안양';
      row[6] = '두현숙';
      row[23] = item.product_code || '';
      row[26] = item.quantity || '';
      row[27] = item.price || '';
      sheet.appendRow(row);
      Logger.log('행 추가 완료');
    }
    
    return ContentService.createTextOutput(
      JSON.stringify({ result: 'ok' })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    Logger.log('오류: ' + err.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ result: 'error', message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function notifyNewOrder(e) {
  return;
}

function installNotifyNewOrderTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const triggers = ScriptApp.getProjectTriggers();

  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'notifyNewOrder') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  Logger.log('[installNotifyNewOrderTrigger] notifyNewOrder trigger disabled');
}

// ════════════════════════════════════════════════════════
// ■ 주간 가격 이력 순수 도메인 함수
// ════════════════════════════════════════════════════════

function makeWeeklyPriceKey_(runAt) {
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const kstDate = new Date(runAt.getTime() + KST_OFFSET_MS);
    const daysSinceCompletedSunday = kstDate.getUTCDay() || 7;
    const completedSunday = new Date(Date.UTC(
        kstDate.getUTCFullYear(),
        kstDate.getUTCMonth(),
        kstDate.getUTCDate() - daysSinceCompletedSunday
    ));
    const completedMonday = new Date(completedSunday.getTime() - 6 * DAY_MS);
    const pad = value => String(value).padStart(2, '0');
    const monday = `${completedMonday.getUTCFullYear()}-${pad(completedMonday.getUTCMonth() + 1)}-${pad(completedMonday.getUTCDate())}`;
    const sunday = `${pad(completedSunday.getUTCMonth() + 1)}-${pad(completedSunday.getUTCDate())}`;
    return `${monday}~${sunday}(일)`;
}

function toSupplyPrice_(vatIncluded) {
    return Math.round(vatIncluded / 1.1);
}

function validateWeeklyEnvelope_(envelope, mappingRows, runAt) {
    const targetKeys = new Set();
    mappingRows.forEach(row => {
        if (row && typeof row.stableKey === 'string') {
            const stableKey = row.stableKey.trim();
            if (/^[1-9]\d*:\S+$/.test(stableKey)) targetKeys.add(stableKey);
        }
    });
    const targetCount = targetKeys.size;

    if (!envelope || envelope.schemaVersion !== 2 || !envelope.groups || typeof envelope.groups !== 'object') {
        return {
            ok: false,
            code: 'INVALID_SCHEMA',
            message: 'Catalog snapshot must use schema version 2.',
            targetCount,
            matchedCount: 0,
        };
    }
    const groups = Object.values(envelope.groups);
    if (groups.some(group => !group || !Array.isArray(group.children))) {
        return {
            ok: false,
            code: 'INVALID_SCHEMA',
            message: 'Catalog snapshot groups must contain child arrays.',
            targetCount,
            matchedCount: 0,
        };
    }

    const snapshotKeys = new Set();
    let duplicateStableKey = '';
    let hasInvalidPrice = false;
    let hasInvalidStableKey = false;
    let hasMalformedChild = false;
    groups.forEach(group => {
        group.children.forEach(child => {
            if (!child || typeof child !== 'object' || Array.isArray(child)) {
                hasMalformedChild = true;
                return;
            }
            if (!Number.isFinite(child.price) || child.price <= 0) hasInvalidPrice = true;
            const hasProductNo = Number.isFinite(Number(child.productNo)) && Number(child.productNo) > 0;
            const hasVariantCode = typeof child.variantCode === 'string' && child.variantCode.trim() !== '';
            if (!hasProductNo || (child.isSingle !== true && !hasVariantCode)) {
                hasInvalidStableKey = true;
                return;
            }
            const suffix = child.isSingle === true ? 'SINGLE' : child.variantCode;
            const stableKey = `${child.productNo}:${suffix}`;
            if (snapshotKeys.has(stableKey)) duplicateStableKey = stableKey;
            snapshotKeys.add(stableKey);
        });
    });

    if (hasMalformedChild) {
        return {
            ok: false,
            code: 'INVALID_SCHEMA',
            message: 'Catalog snapshot children must be objects.',
            targetCount,
            matchedCount: 0,
        };
    }

    if (hasInvalidPrice) {
        return {
            ok: false,
            code: 'INVALID_PRICE',
            message: 'Catalog snapshot prices must be positive finite numbers.',
            targetCount,
            matchedCount: 0,
        };
    }
    if (hasInvalidStableKey) {
        return {
            ok: false,
            code: 'INVALID_STABLE_KEY',
            message: 'Catalog snapshot child is missing stable identity metadata.',
            targetCount,
            matchedCount: 0,
        };
    }

    if (duplicateStableKey) {
        return {
            ok: false,
            code: 'DUPLICATE_STABLE_KEY',
            message: `Catalog snapshot contains duplicate stable key ${duplicateStableKey}.`,
            targetCount,
            matchedCount: 0,
        };
    }
    if (targetCount === 0) {
        return {
            ok: false,
            code: 'EMPTY_MAPPING',
            message: 'No valid unique mapping keys were provided.',
            targetCount: 0,
            matchedCount: 0,
        };
    }

    let matchedCount = 0;
    targetKeys.forEach(key => {
        if (snapshotKeys.has(key)) matchedCount++;
    });
    const generatedAt = envelope.generatedAt;
    const ageMs = runAt.getTime() - new Date(generatedAt).getTime();
    const coveragePct = matchedCount / targetCount * 100;

    if (typeof generatedAt !== 'string' || !Number.isFinite(new Date(generatedAt).getTime())) {
        return {
            ok: false,
            code: 'INVALID_GENERATED_AT',
            message: 'Catalog snapshot generatedAt must be a valid timestamp.',
            targetCount,
            matchedCount,
        };
    }
    if (ageMs < 0) {
        return {
            ok: false,
            code: 'FUTURE_SNAPSHOT',
            message: 'Catalog snapshot generatedAt is in the future.',
            targetCount,
            matchedCount,
        };
    }

    if (ageMs > 24 * 60 * 60 * 1000) {
        return {
            ok: false,
            code: 'STALE_SNAPSHOT',
            message: 'Catalog snapshot is older than 24 hours.',
            targetCount,
            matchedCount,
        };
    }
    if (coveragePct < 95) {
        return {
            ok: false,
            code: 'LOW_COVERAGE',
            message: 'Catalog snapshot covers less than 95 percent of mapping targets.',
            targetCount,
            matchedCount,
        };
    }

    return { ok: true, generatedAt, ageMs, coveragePct, targetCount, matchedCount };
}

function classifyWeeklySnapshotState_(input) {
    const targetCount = Number(input.targetCount);
    const missingCount = Number(input.missingCount);
    if (!Number.isFinite(targetCount) || targetCount <= 0 ||
        !Number.isFinite(missingCount) || missingCount < 0 || missingCount > targetCount ||
        missingCount / targetCount * 100 > 5) {
        return { runResult: 'FAILED', snapshotState: null };
    }

    if (!input.existingState) {
        return missingCount === 0
            ? { runResult: 'CREATED', snapshotState: 'CREATED_COMPLETE' }
            : { runResult: 'CREATED', snapshotState: 'CREATED_PARTIAL' };
    }

    if (input.existingState === 'CREATED_PARTIAL') {
        const supplementAgeMs = new Date(input.runAt).getTime() - new Date(input.firstWrittenAt).getTime();
        if (!Number.isFinite(supplementAgeMs) || supplementAgeMs < 0) {
            return { runResult: 'FAILED', snapshotState: null };
        }
        if (supplementAgeMs > 24 * 60 * 60 * 1000) {
            return { runResult: 'SKIPPED', snapshotState: 'LOCKED_PARTIAL' };
        }
        return missingCount === 0
            ? { runResult: 'SUPPLEMENTED', snapshotState: 'CREATED_COMPLETE' }
            : { runResult: 'SUPPLEMENTED', snapshotState: 'CREATED_PARTIAL' };
    }

    if (input.existingState === 'LOCKED_PARTIAL') {
        return { runResult: 'SKIPPED', snapshotState: 'LOCKED_PARTIAL' };
    }

    return { runResult: 'FAILED', snapshotState: null };
}

function projectWeeklyRows_(input) {
    const rows = (input.existingRows || []).map(row => [row[0], row[1], row[2]]);
    const weekValues = rows.map((_, index) => {
        const value = (input.existingWeekValues || [])[index];
        return value === undefined || value === null ? '' : value;
    });
    const nameWrites = [];
    const rowWrites = [];
    const priceWrites = [];
    const rowIndexByKey = new Map();
    rows.forEach((row, index) => {
        const key = typeof row[2] === 'string' ? row[2].trim() : '';
        if (key && !rowIndexByKey.has(key)) rowIndexByKey.set(key, index);
    });

    const activeKeys = new Set();
    (input.mappingRows || []).forEach(mappingRow => {
        if (!mappingRow || typeof mappingRow.stableKey !== 'string') return;
        const stableKey = mappingRow.stableKey.trim();
        if (!stableKey || activeKeys.has(stableKey)) return;
        activeKeys.add(stableKey);

        let rowIndex = rowIndexByKey.get(stableKey);
        if (rowIndex === undefined) {
            rowIndex = rows.length;
            const values = [mappingRow.prodCd || '', mappingRow.productName || '', stableKey];
            rows.push(values.slice());
            weekValues.push('');
            rowIndexByKey.set(stableKey, rowIndex);
            rowWrites.push({ rowIndex, values });
        } else {
            const nextName = mappingRow.productName || '';
            if (rows[rowIndex][1] !== nextName) {
                rows[rowIndex][1] = nextName;
                nameWrites.push({ rowIndex, value: nextName });
            }
        }

        const existingValue = weekValues[rowIndex];
        const isBlank = existingValue === '' || existingValue === null || existingValue === undefined;
        const vatIncluded = input.pricesByKey && input.pricesByKey[stableKey];
        if (isBlank && Number.isFinite(vatIncluded) && vatIncluded > 0) {
            const supplyPrice = toSupplyPrice_(vatIncluded);
            weekValues[rowIndex] = supplyPrice;
            priceWrites.push({ rowIndex, value: supplyPrice });
        }
    });

    let recordedCount = 0;
    activeKeys.forEach(stableKey => {
        const value = weekValues[rowIndexByKey.get(stableKey)];
        if (value !== '' && value !== null && value !== undefined) recordedCount++;
    });

    return {
        rows,
        weekValues,
        nameWrites,
        rowWrites,
        priceWrites,
        recordedCount,
        missingCount: activeKeys.size - recordedCount,
    };
}

// ════════════════════════════════════════════════════════
// ■ 주간 가격 이력 GAS 어댑터 / 오케스트레이터
// ════════════════════════════════════════════════════════

function weeklySnapshotNow_() {
    return new Date();
}

function weeklySnapshotError_(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function fetchWeeklyPriceEnvelope_() {
    const props = PropertiesService.getScriptProperties();
    const url = props.getProperty('WEEKLY_PRICE_SNAPSHOT_URL');
    const secret = props.getProperty('WEEKLY_PRICE_SNAPSHOT_SECRET');
    if (!url) {
        throw weeklySnapshotError_('MISSING_SNAPSHOT_URL', 'Weekly snapshot URL is not configured.');
    }
    if (!secret) {
        throw weeklySnapshotError_('MISSING_SNAPSHOT_SECRET', 'Weekly snapshot secret is not configured.');
    }

    let response;
    try {
        response = UrlFetchApp.fetch(url, {
            method: 'get',
            headers: { Authorization: 'Bearer ' + secret },
            muteHttpExceptions: true,
            followRedirects: false,
            validateHttpsCertificates: true,
            timeoutSeconds: 30,
        });
    } catch (error) {
        throw weeklySnapshotError_('SNAPSHOT_FETCH_FAILED', 'Weekly snapshot fetch failed.');
    }

    const status = response.getResponseCode();
    if (status !== 200) {
        const code = status === 401
            ? 'SNAPSHOT_UNAUTHORIZED'
            : status === 429
                ? 'SNAPSHOT_RATE_LIMITED'
                : status >= 500
                    ? 'SNAPSHOT_UPSTREAM_FAILED'
                    : 'SNAPSHOT_HTTP_ERROR';
        throw weeklySnapshotError_(code, 'Weekly snapshot returned HTTP ' + status + '.');
    }

    const body = response.getContentText();
    if (typeof body !== 'string' || body.length > 5 * 1024 * 1024) {
        throw weeklySnapshotError_('SNAPSHOT_RESPONSE_TOO_LARGE', 'Weekly snapshot response is invalid.');
    }
    let envelope;
    try {
        envelope = JSON.parse(body);
    } catch (error) {
        throw weeklySnapshotError_('SNAPSHOT_INVALID_JSON', 'Weekly snapshot response is not valid JSON.');
    }
    if (!envelope || envelope.schemaVersion !== 2) {
        throw weeklySnapshotError_('SNAPSHOT_INVALID_SCHEMA', 'Weekly snapshot must use schema version 2.');
    }
    return envelope;
}

function readWeeklyPriceMapping_(spreadsheet) {
    const sheet = spreadsheet.getSheetByName('카페24상품');
    if (!sheet) {
        throw weeklySnapshotError_('MAPPING_SHEET_MISSING', 'The Cafe24 product mapping sheet is missing.');
    }
    const values = sheet.getDataRange().getValues();
    const rows = [];
    const seenKeys = new Set();
    for (let index = 1; index < values.length; index++) {
        const source = values[index] || [];
        const productNo = String(source[0] === undefined || source[0] === null ? '' : source[0]).trim();
        const productName = String(source[2] === undefined || source[2] === null ? '' : source[2]).trim();
        const prodCd = String(source[3] === undefined || source[3] === null ? '' : source[3]).trim();
        const variantCode = String(source[4] === undefined || source[4] === null ? '' : source[4]).trim();
        let reason = '';
        if (!/^[1-9]\d*$/.test(productNo)) reason = 'MISSING_PRODUCT_NO';
        else if (!prodCd) reason = 'MISSING_CUSTOM_VARIANT_CODE';
        else if (!variantCode) reason = 'MISSING_VARIANT_IDENTITY';
        const stableKey = reason ? '' : productNo + ':' + variantCode;
        if (!reason && seenKeys.has(stableKey)) reason = 'DUPLICATE_STABLE_KEY';
        if (reason) {
            Logger.log('[snapshotWeeklyPrice] code=MAPPING_ROW_EXCLUDED row=' + (index + 1) +
                ' reason=' + reason + ' productNo=' + (productNo || '-') + ' prodCd=' + (prodCd || '-'));
            continue;
        }
        seenKeys.add(stableKey);
        rows.push({ prodCd, productName, stableKey });
    }
    return rows;
}

function weeklyPricesByKey_(envelope) {
    const prices = {};
    Object.values(envelope.groups || {}).forEach(group => {
        (group.children || []).forEach(child => {
            if (!child || typeof child !== 'object') return;
            const suffix = child.isSingle === true ? 'SINGLE' : child.variantCode;
            prices[String(child.productNo) + ':' + suffix] = child.price;
        });
    });
    return prices;
}

function weeklyMetadataKey_(weekKey) {
    return 'WEEKLY_PRICE_SNAPSHOT:' + weekKey;
}

function readWeeklyMetadata_(sheet, weekKey) {
    if (!sheet) return null;
    const found = sheet.createDeveloperMetadataFinder().withKey(weeklyMetadataKey_(weekKey)).find();
    if (!found || found.length === 0) return null;
    let value;
    try {
        value = JSON.parse(found[0].getValue());
    } catch (error) {
        throw weeklySnapshotError_('INVALID_WEEK_METADATA', 'Weekly snapshot metadata is malformed.');
    }
    if (!value || typeof value.firstWrittenAt !== 'string' || typeof value.state !== 'string') {
        throw weeklySnapshotError_('INVALID_WEEK_METADATA', 'Weekly snapshot metadata is incomplete.');
    }
    return { firstWrittenAt: value.firstWrittenAt, state: value.state };
}

function readWeeklyHistoryState_(sheet, weekKey) {
    if (!sheet) {
        return {
            exists: false,
            lastColumn: 0,
            weekColumn: 0,
            rows: [],
            weekValues: [],
            metadata: null,
        };
    }
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    const values = lastRow > 0 && lastColumn > 0
        ? sheet.getRange(1, 1, lastRow, lastColumn).getValues()
        : [];
    const headers = values[0] || [];
    const weekColumn = headers.indexOf(weekKey) + 1;
    const metadata = readWeeklyMetadata_(sheet, weekKey);
    if (weekColumn > 0 && !metadata) {
        throw weeklySnapshotError_('UNTRACKED_WEEK_COLUMN', 'Weekly price column exists without metadata.');
    }
    if (metadata && weekColumn === 0) {
        throw weeklySnapshotError_('MISSING_WEEK_COLUMN', 'Weekly snapshot metadata exists without a price column.');
    }
    const rows = values.slice(1).map(row => [row[0] || '', row[1] || '', row[2] || '']);
    const weekValues = weekColumn > 0
        ? values.slice(1).map(row => row[weekColumn - 1] === undefined || row[weekColumn - 1] === null ? '' : row[weekColumn - 1])
        : rows.map(() => '');
    return { exists: true, lastColumn, weekColumn, rows, weekValues, metadata };
}

function makeWeeklyMetadataValue_(firstWrittenAt, state) {
    return JSON.stringify({ firstWrittenAt, state });
}

function freezeWeeklyWritePlan_(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => freezeWeeklyWritePlan_(value[key]));
    return Object.freeze(value);
}

function validateWeeklyWritePlan_(plan) {
    if (!plan || !plan.kind || !plan.metadataKey || !plan.metadataValue) {
        throw weeklySnapshotError_('INVALID_WRITE_PLAN', 'Weekly write plan is incomplete.');
    }
    if (plan.kind === 'CREATE_WEEK') {
        if (!Number.isInteger(plan.weekColumn) || plan.weekColumn < 4 ||
            !Array.isArray(plan.rows) || !Array.isArray(plan.weekValues) ||
            plan.rows.length !== plan.weekValues.length) {
            throw weeklySnapshotError_('INVALID_WRITE_PLAN', 'Weekly create plan is invalid.');
        }
    } else if (plan.kind === 'SUPPLEMENT') {
        const seenPriceRows = new Set();
        (plan.priceWrites || []).forEach(write => {
            if (!Number.isInteger(write.rowIndex) || write.rowIndex < 0 || seenPriceRows.has(write.rowIndex) ||
                (plan.existingWeekValues[write.rowIndex] !== '' &&
                 plan.existingWeekValues[write.rowIndex] !== null &&
                 plan.existingWeekValues[write.rowIndex] !== undefined)) {
                throw weeklySnapshotError_('UNSAFE_PRICE_WRITE', 'Weekly supplement plan would overwrite a price.');
            }
            seenPriceRows.add(write.rowIndex);
        });
    } else if (plan.kind !== 'METADATA_ONLY') {
        throw weeklySnapshotError_('INVALID_WRITE_PLAN', 'Weekly write plan kind is invalid.');
    }
    return freezeWeeklyWritePlan_(plan);
}

function groupWeeklyWrites_(writes, valueSelector) {
    const sorted = (writes || []).slice().sort((left, right) => left.rowIndex - right.rowIndex);
    const groups = [];
    sorted.forEach(write => {
        const values = valueSelector(write);
        const last = groups[groups.length - 1];
        if (last && last.startRowIndex + last.values.length === write.rowIndex) {
            last.values.push(values);
        } else {
            groups.push({ startRowIndex: write.rowIndex, values: [values] });
        }
    });
    return groups;
}

function writeWeeklyMetadata_(sheet, key, value) {
    const found = sheet.createDeveloperMetadataFinder().withKey(key).find();
    if (found && found.length > 0) found[0].setValue(value);
    else sheet.addDeveloperMetadata(key, value);
}

function executeWeeklyWritePlan_(spreadsheet, existingSheet, plan) {
    let sheet = existingSheet;
    if (plan.kind === 'CREATE_WEEK') {
        if (!sheet) sheet = spreadsheet.insertSheet('가격이력');
        const metadataRows = [['PROD_CD', '웹카탈로그 상품명', '상품키']].concat(plan.rows);
        sheet.getRange(1, 1, metadataRows.length, 3).setValues(metadataRows);
        const weekColumnValues = [[plan.weekKey]].concat(plan.weekValues.map(value => [value]));
        sheet.getRange(1, plan.weekColumn, weekColumnValues.length, 1).setValues(weekColumnValues);
        if (plan.hideColumnC) sheet.hideColumns(3);
    } else if (plan.kind === 'SUPPLEMENT') {
        groupWeeklyWrites_(plan.rowWrites, write => write.values.slice())
            .forEach(group => sheet.getRange(group.startRowIndex + 2, 1, group.values.length, 3).setValues(group.values));
        groupWeeklyWrites_(plan.nameWrites, write => [write.value])
            .forEach(group => sheet.getRange(group.startRowIndex + 2, 2, group.values.length, 1).setValues(group.values));
        groupWeeklyWrites_(plan.priceWrites, write => [write.value])
            .forEach(group => sheet.getRange(group.startRowIndex + 2, plan.weekColumn, group.values.length, 1).setValues(group.values));
    }
    writeWeeklyMetadata_(sheet, plan.metadataKey, plan.metadataValue);
}

function weeklySnapshotSummary_(input) {
    return {
        weekKey: input.weekKey || null,
        runResult: input.runResult,
        snapshotState: input.snapshotState || null,
        targetCount: Number(input.targetCount) || 0,
        recordedCount: Number(input.recordedCount) || 0,
        missingCount: Number(input.missingCount) || 0,
        generatedAt: input.generatedAt || null,
        coveragePct: Number(input.coveragePct) || 0,
    };
}

function logWeeklySnapshotSummary_(summary, code) {
    Logger.log('[snapshotWeeklyPrice] code=' + code +
        ' weekKey=' + (summary.weekKey || '-') +
        ' runResult=' + summary.runResult +
        ' snapshotState=' + (summary.snapshotState || '-') +
        ' targetCount=' + summary.targetCount +
        ' recordedCount=' + summary.recordedCount +
        ' missingCount=' + summary.missingCount +
        ' generatedAt=' + (summary.generatedAt || '-') +
        ' coveragePct=' + summary.coveragePct);
}

function snapshotWeeklyPrice() {
    const lock = LockService.getScriptLock();
    let acquired = false;
    try {
        acquired = lock.tryLock(1000);
    } catch (error) {
        acquired = false;
    }
    if (!acquired) {
        const lockedSummary = weeklySnapshotSummary_({ runResult: 'FAILED' });
        logWeeklySnapshotSummary_(lockedSummary, 'LOCK_NOT_ACQUIRED');
        return lockedSummary;
    }

    let weekKey = null;
    let envelope = null;
    let validation = null;
    try {
        const runAt = weeklySnapshotNow_();
        weekKey = makeWeeklyPriceKey_(runAt);
        envelope = fetchWeeklyPriceEnvelope_();
        const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        const mappingRows = readWeeklyPriceMapping_(spreadsheet);
        validation = validateWeeklyEnvelope_(envelope, mappingRows, runAt);
        if (!validation.ok) {
            throw weeklySnapshotError_(validation.code, validation.message);
        }

        const historySheet = spreadsheet.getSheetByName('가격이력');
        const history = readWeeklyHistoryState_(historySheet, weekKey);
        if (history.metadata && history.metadata.state === 'CREATED_COMPLETE') {
            const skippedComplete = weeklySnapshotSummary_({
                weekKey,
                runResult: 'SKIPPED',
                snapshotState: 'CREATED_COMPLETE',
                targetCount: validation.targetCount,
                recordedCount: validation.targetCount,
                missingCount: 0,
                generatedAt: validation.generatedAt,
                coveragePct: validation.coveragePct,
            });
            logWeeklySnapshotSummary_(skippedComplete, 'COMPLETE_WEEK_EXISTS');
            return skippedComplete;
        }

        const projection = projectWeeklyRows_({
            existingRows: history.rows,
            existingWeekValues: history.weekValues,
            mappingRows,
            pricesByKey: weeklyPricesByKey_(envelope),
        });
        const classified = classifyWeeklySnapshotState_({
            existingState: history.metadata ? history.metadata.state : null,
            firstWrittenAt: history.metadata ? history.metadata.firstWrittenAt : null,
            targetCount: validation.targetCount,
            missingCount: projection.missingCount,
            runAt,
        });
        if (classified.runResult === 'FAILED') {
            throw weeklySnapshotError_('MISSING_RATE_TOO_HIGH', 'Weekly snapshot missing rate exceeds five percent.');
        }

        const firstWrittenAt = history.metadata ? history.metadata.firstWrittenAt : runAt.toISOString();
        const metadataKey = weeklyMetadataKey_(weekKey);
        const metadataValue = makeWeeklyMetadataValue_(firstWrittenAt, classified.snapshotState);
        let plan;
        if (classified.runResult === 'CREATED') {
            plan = {
                kind: 'CREATE_WEEK',
                weekKey,
                weekColumn: Math.max(4, history.lastColumn + 1),
                rows: projection.rows.map(row => row.slice()),
                weekValues: projection.weekValues.slice(),
                hideColumnC: !history.exists,
                metadataKey,
                metadataValue,
            };
        } else if (classified.runResult === 'SUPPLEMENTED') {
            plan = {
                kind: 'SUPPLEMENT',
                weekKey,
                weekColumn: history.weekColumn,
                existingWeekValues: history.weekValues.slice(),
                rowWrites: projection.rowWrites.map(write => ({ rowIndex: write.rowIndex, values: write.values.slice() })),
                nameWrites: projection.nameWrites.map(write => ({ rowIndex: write.rowIndex, value: write.value })),
                priceWrites: projection.priceWrites.map(write => ({ rowIndex: write.rowIndex, value: write.value })),
                metadataKey,
                metadataValue,
            };
        } else {
            plan = { kind: 'METADATA_ONLY', metadataKey, metadataValue };
        }
        const immutablePlan = validateWeeklyWritePlan_(plan);
        executeWeeklyWritePlan_(spreadsheet, historySheet, immutablePlan);

        const summary = weeklySnapshotSummary_({
            weekKey,
            runResult: classified.runResult,
            snapshotState: classified.snapshotState,
            targetCount: validation.targetCount,
            recordedCount: projection.recordedCount,
            missingCount: projection.missingCount,
            generatedAt: validation.generatedAt,
            coveragePct: validation.coveragePct,
        });
        logWeeklySnapshotSummary_(summary, classified.snapshotState);
        return summary;
    } catch (error) {
        const targetCount = validation ? validation.targetCount : 0;
        const recordedCount = validation ? validation.matchedCount : 0;
        const coveragePct = validation && Number.isFinite(validation.coveragePct)
            ? validation.coveragePct
            : targetCount > 0 ? recordedCount / targetCount * 100 : 0;
        const failedSummary = weeklySnapshotSummary_({
            weekKey,
            runResult: 'FAILED',
            snapshotState: null,
            targetCount,
            recordedCount,
            missingCount: Math.max(0, targetCount - recordedCount),
            generatedAt: validation && validation.generatedAt
                ? validation.generatedAt
                : envelope && typeof envelope.generatedAt === 'string' ? envelope.generatedAt : null,
            coveragePct,
        });
        logWeeklySnapshotSummary_(failedSummary, error && error.code ? error.code : 'UNEXPECTED_ERROR');
        return failedSummary;
    } finally {
        lock.releaseLock();
    }
}
