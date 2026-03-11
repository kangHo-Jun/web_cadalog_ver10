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
 *   [매핑테이블] A: custom_variant_code | B: product_no | C: variant_code | D: cached_price | E: 최근업데이트 | F: 결과
 *   [실행로그]   A: 실행시각 | B: 업데이트 | C: 스킵 | D: 오류 | E: 상세
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
};

const SH = { CONFIG: '설정', MAPPING: '매핑테이블', LOG: '실행로그' };
const C24_PAGE_SIZE = 100;
const DELAY_MS = 300;   // API 호출 간 딜레이 (429 방지)
const TIME_LIMIT_MS = 320000; // 5분 20초 (GAS 6분 제한 대비 여유)

// 구형 매핑테이블 CSV 기반 product_no 폴백 (ecount_prod_cd -> cafe24_product_no)
// const LEGACY_PRODUCT_NO_MAP = { "(1)100LVL30308": "1407", "(1)100구조재A14": "1674", "(1)100구조재A16": "1675", "(1)100구조재A18": "1676", "(1)100구조재B110": "1677", "(1)100구조재B112": "1678", "(1)100구조재C22": "1679", "(1)100구조재C24": "1680", "(1)100구조재C26": "1681", "(1)100구조재C28": "1682", "(1)100구조재D212": "1684", "(1)100구조재E70각": "836", "(1)100구조재E90각": "896", "(1)100라왕301400원": "1801", "(1)100라왕심재": "1617", "(1)100라왕한치각": "1616", "(1)100라왕후지": "1618", "(1)100목망꽃바둑1015": "1403", "(1)100목망캡": "1107", "(1)100미송루바8자": "839", "(1)100방부목1120": "1000", "(1)100방부목295": "1000", "(1)100방부목3140": "1000", "(1)100방부목4A22": "1659", "(1)100방부목524": "1660", "(1)100방부목626": "1661", "(1)100방부목8212": "1664", "(1)100방부목91라티": "1177", "(1)100방부목944": "1665", "(1)100방킬8자": "877", "(1)100소송1303012": "1613", "(1)100소송2306912": "1614", "(1)100소송330308": "1611", "(1)100소송4203012": "1615", "(1)100소송53030121": "1614", "(1)100소송63069121": "1614", "(1)100자나무": "975", "(1)100편백루바18유": "1317", "(1)100편백루바8무": "1317", "(1)200A자이01일반93": "1415", "(1)200국산2차음1236": "1622", "(1)200자이02방수936": "1416", "(1)200자이03방화1236": "811", "(1)200자이04일반1236": "1552", "(1)200자이05일반938": "1415", "(1)200하국산방화1236": "1621", "(1)201CRC636": "1164", "(1)201CRC936": "1164", "(1)201석고텍스KCC": "1379", "(1)3001A2748BB": "1604", "(1)3001B448오징": "936", "(1)3001C4648BB": "1604", "(1)3001D4648알": "936", "(1)3001E8548BB": "1604", "(1)3001F8548MLH": "936", "(1)3001G38548콤": "1641", "(1)3001H11548BB": "1604", "(1)3001I11548MLH": "936", "(1)3001J11548콤": "1641", "(1)3001K11548다": "1642", "(1)3001L14548BB": "1604", "(1)3001M17548BB": "1604", "(1)3001Y코아18알": "787", "(1)3001Z코아18라": "787", "(1)300A12736B": "1371", "(1)300A1자작SBB4": "1604", "(1)300A24636B": "1371", "(1)300A2자작SBB6": "1604", "(1)300A38536B": "1371", "(1)300A3자작SBB9": "1604", "(1)300A48536알": "1371", "(1)300A4자작SBB12": "1604", "(1)300A511536B": "1371", "(1)300A5자작SBB15": "1604", "(1)300A611536M": "1371", "(1)300A6자작SBB18": "1604", "(1)300B1미송유48": "783", "(1)300B2미송유85": "783", "(1)300B3미송유12": "783", "(1)300B4미송유15": "783", "(1)300B5미송유18": "783", "(1)300B6미송무45": "959", "(1)300C1낙엽48": "852", "(1)300C2낙엽75": "852", "(1)300C3낙엽115": "852", "(1)300E낙엽18": "852", "(1)300OSB11내": "1565", "(1)300OSB8내": "1565", "(1)300내수1248수": "1018", "(1)300내수21236수": "833", "(1)300백색27": "1015", "(1)300오크27": "936", "(1)300준내수948": "1018", "(1)300태고1248N": "1638", "(1)300태고21236": "833", "(1)301MDF113고밀": "781", "(1)301MDF1245고밀": "781", "(1)301MDF136USB": "781", "(1)301MDF149USB": "781", "(1)301MDF1512USB": "781", "(1)301MDF1615USB": "781", "(1)301MDF1718USB": "781", "(1)301MDF1825UB": "781", "(1)301MDF1930UB": "781", "(1)301MDF206고밀": "1672", "(1)301MDF209고밀": "1672", "(1)301MDF2112고밀": "1672", "(1)301MDF2215고밀": "1672", "(1)301MDF2318고밀": "1672", "(1)302고무12탑": "960", "(1)302고무15탑": "960", "(1)302고무18탑": "960", "(1)302라디12탑": "1655", "(1)302라디15탑": "1655", "(1)302라디18탑": "1655", "(1)302라디24탑": "1655", "(1)302라디30탑": "1655", "(1)302레드12솔": "1801", "(1)302레드15솔": "1801", "(1)302레드18솔": "1801", "(1)302레드60각": "1795", "(1)302멀바1238": "1814", "(1)302멀바1538": "1814", "(1)302멀바1838": "1814", "(1)302멀바1848": "1739", "(1)302멀바계단30300": "927", "(1)302멀바계단38300": "1733", "(1)302미송계단38300": "1733", "(1)302미송대봉9090": "1650", "(1)302미송반달4070": "1284", "(1)302미송소봉4040": "1287", "(1)302미송식빵6070": "1289", "(1)302삼목12솔": "1811", "(1)302삼목15솔": "1811", "(1)302삼목18솔": "1811", "(1)302쏘노30300": "920", "(1)302아카15유": "1772", "(1)302아카18N무": "1776", "(1)302아카18유": "1772", "(1)302에쉬1848": "1645", "(1)302오동12솔": "1174", "(1)500다크브201328": "956", "(1)500도장피스838": "1380", "(1)500미들클립20": "1402", "(1)500스타트클립20": "1865", "(1)500아티론": "869", "(1)500클립피스820": "842", "(1)502백스페": "875", "(1)503스카이비바": "1231", "(1)503차음시트기본": "1701", "(1)503타공라메9": "1228", "(1)503타공원메9": "1227", "(1)60010그라스울기본": "979", "(1)60011아이소101호": "1593", "(1)60011이보드13도배": "1596", "(1)60012아이소20특": "1593", "(1)60012이보드23도배": "1597", "(1)60013아이소30특": "1593", "(1)60013이보드33도배": "1598", "(1)60014아이소50특": "848", "(1)60015아이소100특": "848", "(1)6001열반사10양": "885", "(1)6001열반사6양": "885", "(1)6002열반사10양": "885", "(1)6002열반사6양": "885", "(1)600LXPF301800N": "1546", "(1)600LXPF501800N": "1547", "(1)600LXPF901800N": "1548", "(1)600이보드13페": "1599", "(1)600이보드23페": "1600", "(1)600이보드33페": "1601", "(1)700168401걸레": "1828", "(1)700AL앵글도장": "1692", "(1)700A합7351935": "933", "(1)700B합7352035": "933", "(1)700C합8352035": "933", "(1)700D합9352035": "933", "(1)700E합8002000무": "1563", "(1)700F합8002000유": "1563", "(1)700G합8002100무": "1563", "(1)700H합9002100무": "1589", "(1)700I합9002100유": "1589", "(1)700J합1102100다": "1618", "(1)700K합100800요": "1231", "(1)700L합110900요": "1231", "(1)700P마이너메지95": "1401", "(1)700메지도장95": "987", "(1)700영1162계단": "1398", "(1)700영116301걸레": "1825", "(1)700영116601걸레": "1829", "(1)700영11680020001": "1345", "(1)700영11680020002": "1345", "(1)700영11690021001": "1345", "(1)700영11690021002": "1345", "(1)700영116901걸레": "1830", "(1)700영116P마이너": "1832", "(1)700영116마이너": "1823", "(1)700영116문선": "1830", "(1)700영116시트": "1854", "(1)700영116엣지": "1830", "(1)700영116천정1": "1827", "(1)700영116천정2": "1398", "(1)700영116천정3": "1398", "(1)700영116코너중": "1398", "(1)700영116평100": "1827", "(1)700영116평120": "1827", "(1)700영116평160": "1826", "(1)700영116평200": "1827", "(1)700영116평250": "1827", "(1)700영116평30": "1824", "(1)700영116평300": "1824", "(1)700영116평40": "1822", "(1)700영116평60": "1826", "(1)700영116평80": "1827", "(1)700영116평문선": "1823", "(1)700영161시트": "1854", "(1)700영168301걸레": "1825", "(1)700영16890021002": "1350", "(1)700영168마이너": "1823", "(1)700영168엣지": "1823", "(1)700영168평30": "1824", "(1)700영168평40": "1822", "(1)700영168평60": "1826", "(1)700영169301걸레": "1825", "(1)700영169401걸레": "1828", "(1)700영16990021002": "1350", "(1)700영169마이너": "1823", "(1)700영169엣지": "1823", "(1)700영169평30": "1824", "(1)700영169평40": "1822", "(1)700영169평60": "1826", "(1)700영194301걸레": "1825", "(1)700영194401걸레": "1828", "(1)700영194마이너스": "1823", "(1)700영194평30": "1824", "(1)700영194평40": "1822", "(1)700영194평60": "1826", "(1)700영195301걸레": "1825", "(1)700영195401걸레": "1828", "(1)700영195엣지": "1823", "(1)700영2580020001": "1346", "(1)700영2580020002": "1346", "(1)700영2590021001": "1592", "(1)700영2590021002": "1592", "(1)700영25코너대": "1622", "(1)700영25코너소": "1238", "(1)700영2780020001": "1346", "(1)700영2780020002": "1346", "(1)700영2790021001": "1590", "(1)700영3480020002": "1347", "(1)700영402계단": "1336", "(1)700영403계단": "1238", "(1)700영4080020001": "1348", "(1)700영4080020002": "1348", "(1)700영4090021001": "1593", "(1)700영4090021002": "1593", "(1)700영40901걸레": "1830", "(1)700영40마이너": "1823", "(1)700영40문선": "1238", "(1)700영40엣지": "1238", "(1)700영40천정1": "1335", "(1)700영40천정2": "1336", "(1)700영40천정3": "1337", "(1)700영40코너30": "1824", "(1)700영40코너대": "1231", "(1)700영40코너소": "1822", "(1)700영40코너중": "1238", "(1)700영40평100": "1827", "(1)700영40평120": "1335", "(1)700영40평160": "1826", "(1)700영40평200": "1336", "(1)700영40평250": "1336", "(1)700영40평30": "1238", "(1)700영40평300": "1337", "(1)700영40평40": "1238", "(1)700영40평60": "1238", "(1)700영40평80": "1238", "(1)700영40필름M": "1854", "(1)700영5080020001": "979", "(1)700영5080020002": "979", "(1)700영5090021001": "1593", "(1)700영5090021002": "1593", "(1)700영50엣지": "1233", "(1)700영5380020001": "1827", "(1)700영5380020002": "1827", "(1)700영5390021001": "978", "(1)700영5390021002": "978", "(1)700영53시트": "1854", "(1)700영53엣지": "1237", "(1)700영PS170평40": "1822", "(1)700영P백2계단대": "1843", "(1)700영P백2계단소": "1843", "(1)700영더1167331935": "1341", "(1)700영더1167331960": "1341", "(1)700영더1167332060": "1341", "(1)700영더1168332035": "1342", "(1)700영더1168332060": "1342", "(1)700영더1688332060": "1342", "(1)700영더1698332060": "1342", "(1)700영더257331935": "1341", "(1)700영더258332035": "1342", "(1)700영더277331935": "1341", "(1)700영더278332060": "1342", "(1)700영더347331935": "1341", "(1)700영더348332035": "1342", "(1)700영더407331935": "1341", "(1)700영더408332035": "1342", "(1)700영더408332060": "1342", "(1)700영더537331935": "1341", "(1)700영더537331960": "1341", "(1)700영더538332035": "1342", "(1)700영더538332060": "1342", "(1)700영렉스31208": "1370", "(1)700영렉스31210": "1344", "(1)700영렉스31212": "1346", "(1)700영림P마이너": "1832", "(1)700예HP52130걸레": "1825", "(1)700예HP52140걸레": "1828", "(1)700예HP52230걸레": "1837", "(1)700예HP52240걸레": "1838", "(1)80011실리1투명": "964", "(1)80011이지경실": "912", "(1)80011일반경실": "1332", "(1)80011타카422J": "899", "(1)80012실리반투명": "861", "(1)80012이지경골": "912", "(1)80012일반경골": "1332", "(1)80013실리백색": "964", "(1)80013이지경블": "912", "(1)80013일반경블": "1332", "(1)80013총422": "902", "(1)80014영림이지실버": "912", "(1)80014영림일반실버": "1332", "(1)80014이지경백": "1536", "(1)80014피스톤422": "1810", "(1)800CAP44흑": "1665", "(1)800가위": "967", "(1)800고체연료": "1563", "(1)800골판지": "1864", "(1)800뎀핑레일실": "861", "(1)800레일2": "1210", "(1)800레일3": "1837", "(1)800로라미4": "1247", "(1)800마대80": "1400", "(1)800마대90": "1400", "(1)800마대PP": "1454", "(1)800매거양321": "1359", "(1)800매거양625": "1173", "(1)800매거양632": "1402", "(1)800매거양638": "1402", "(1)800매거외321": "1359", "(1)800매거외625": "1173", "(1)800매거외625코": "1359", "(1)800매거외632": "1402", "(1)800매거외638": "1402", "(1)800비닐대": "1703", "(1)800비닐소": "1593", "(1)800빗자루": "1604", "(1)800빠찌링기본": "1162", "(1)800빠찌링백색": "1425", "(1)800빠찌링스텐": "914", "(1)800사륜로라": "1210", "(1)800사포120": "1224", "(1)800사포220": "1110", "(1)800사포320": "1362", "(1)800사포A원형": "1166", "(1)800서랍레일300": "1289", "(1)800서랍레일350": "983", "(1)800서랍레일400": "1279", "(1)800서랍레일450": "1279", "(1)800서랍레일피스": "983", "(1)800석고본드": "1244", "(1)800스텐피스25": "914", "(1)800스텐피스32": "914", "(1)800스텐피스38": "914", "(1)800스텐피스50": "914", "(1)800스토퍼말굽": "1865", "(1)800스토퍼블랙": "1865", "(1)800스토퍼실버": "1865", "(1)800스톱바": "1400", "(1)800실1701GR": "1330", "(1)800실5000BK": "1860", "(1)800실5000GR": "1326", "(1)800실5000WT": "1861", "(1)800실5001BK": "1862", "(1)800실5001GR": "1327", "(1)800실5001WT": "1863", "(1)800실5100GR": "1328", "(1)800실5101GR": "1329", "(1)800실6401GR": "1331", "(1)800실리B1투명": "863", "(1)800실리B반투명": "863", "(1)800실리B백색": "863", "(1)800실리C백색": "864", "(1)800실리골드": "861", "(1)800실리밤색": "964", "(1)800실리아이보리": "861", "(1)800실리우드": "898", "(1)800실리체리": "964", "(1)800실리콘건": "861", "(1)800실리회색": "964", "(1)800실리흑색": "964", "(1)800실타615": "913", "(1)800실타618": "913", "(1)800실타625": "913", "(1)800실타630": "913", "(1)800쓰레받": "1239", "(1)800씽크경유15": "985", "(1)800씽크경유18": "985", "(1)800씽크경일15": "985", "(1)800씽크경일18": "985", "(1)800씽크경피스": "985", "(1)800아연피스25": "929", "(1)800아연피스32": "929", "(1)800아연피스38": "929", "(1)800아연피스50": "929", "(1)800아연피스65": "929", "(1)800아연피스75": "929", "(1)800아연피스90": "842", "(1)800액자레일2": "1425", "(1)800에어건": "902", "(1)800엘가이드": "1400", "(1)800오메가12": "1279", "(1)800오메가7": "1279", "(1)800오메가8": "1279", "(1)800오메가9": "1279", "(1)800오목손사각": "967", "(1)800오목손은": "967", "(1)800오목손타원": "967", "(1)800오일116투명": "1245", "(1)800오일135투명": "1683", "(1)800오일16도토리": "1245", "(1)800오일16밤색": "1245", "(1)800오일16월넛": "1245", "(1)800오일16코코넛": "1245", "(1)800오일16티크": "1245", "(1)800오일16흑단": "1245", "(1)800오일16흑색": "1245", "(1)800오일35다크오렌": "1245", "(1)800오일35도토리": "1417", "(1)800오일35레드와인": "1245", "(1)800오일35마호가니": "1414", "(1)800오일35밝은오크": "1245", "(1)800오일35밤색": "1245", "(1)800오일35살구색": "1245", "(1)800오일35연녹색": "1245", "(1)800오일35연밤색": "1245", "(1)800오일35월넛": "1245", "(1)800오일35자단": "1245", "(1)800오일35참나무": "825", "(1)800오일35체리": "861", "(1)800오일35코코넛": "1245", "(1)800오일35티크": "1245", "(1)800오일35화이트": "1499", "(1)800오일35황색": "1245", "(1)800오일35흑단": "1245", "(1)800오일35흑색": "1245", "(1)800윙스25": "988", "(1)800윙스252": "988", "(1)800윙스32": "988", "(1)800윙스38": "988", "(1)800윙스45": "988", "(1)800윙스55": "988", "(1)800유리다보": "967", "(1)800자유경3": "1855", "(1)800자유경4": "1855", "(1)800장갑1코팅R": "987", "(1)800장갑기능대": "987", "(1)800장갑기능소": "987", "(1)800장갑기능중": "987", "(1)800점검300": "1401", "(1)800점검400": "1401", "(1)800점검450": "1401", "(1)800점검600": "1401", "(1)800점검AL600": "1401", "(1)800점검PVC300": "1401", "(1)800점검PVC400": "1401", "(1)800점검PVC450": "1401", "(1)800점검PVC600": "1401", "(1)800접시13": "910", "(1)800접시25": "910", "(1)800접시32": "910", "(1)800접시38": "910", "(1)800접착205": "980", "(1)800접착777": "849", "(1)800접착G1원": "1242", "(1)800접착G2원": "1243", "(1)800접착G3원": "1244", "(1)800접착아이소": "848", "(1)800접착에폭4": "850", "(1)800접착에폭A10": "850", "(1)800접착프라1": "1244", "(1)800접착프라3": "1244", "(1)800줄자55국": "1851", "(1)800줄자55세": "1851", "(1)800줄자55타": "1842", "(1)800줄자75타": "842", "(1)800철기리30": "1703", "(1)800철기리32": "1683", "(1)800철기리33": "1683", "(1)800총1850A": "902", "(1)800총630R": "902", "(1)800총BN1664": "902", "(1)800총CT64": "902", "(1)800총F30": "902", "(1)800칼브럭625": "913", "(1)800칼브럭640": "1806", "(1)800칼브럭812": "1666", "(1)800칼브럭890": "1593", "(1)800캇타칼": "1642", "(1)800캇타칼고급": "1269", "(1)800캇타칼날": "1401", "(1)800콩피스816": "988", "(1)800타카1022J": "899", "(1)800타카1ST18": "1173", "(1)800타카1ST25": "1173", "(1)800타카1ST32": "1173", "(1)800타카1ST38": "1173", "(1)800타카1ST45": "1173", "(1)800타카1ST50": "1173", "(1)800타카1ST57": "1173", "(1)800타카1ST64": "1173", "(1)800타카416J": "899", "(1)800타카419J": "899", "(1)800타카DT50": "856", "(1)800타카DT64": "1180", "(1)800타카F15": "913", "(1)800타카F20": "1362", "(1)800타카F25": "1705", "(1)800타카F30": "1195", "(1)800타카F40": "1238", "(1)800타카F50": "1709", "(1)800타카FST15": "1173", "(1)800타카FST18": "1173", "(1)800타카FST25": "1173", "(1)800타카FST30": "1173", "(1)800타카JST18": "1704", "(1)800타카JST25": "1705", "(1)800타카JST32": "1706", "(1)800타카JST38": "1707", "(1)800타카JST45": "1708", "(1)800타카JST50": "1709", "(1)800타카JST64": "1710", "(1)800타카T50": "901", "(1)800타카T57": "1534", "(1)800타카T64": "1240", "(1)800테잎25은": "890", "(1)800테잎50은": "890", "(1)800테잎마스대": "1667", "(1)800테잎마스소": "1670", "(1)800테잎박스": "1865", "(1)800테잎청": "1865", "(1)800테잎커버2000": "1666", "(1)800테잎커버2700": "1666", "(1)800테잎커버900": "1666", "(1)800테잎플로": "838", "(1)800텐텐지": "1536", "(1)800톱날265대": "1614", "(1)800톱날300대": "1614", "(1)800톱날330대": "1612", "(1)800톱날A265타": "909", "(1)800톱날A300타": "1614", "(1)800톱날A330타": "1612", "(1)800톱대": "1856", "(1)800퍼티20": "842", "(1)800퍼티5": "1865", "(1)800평붓2": "908", "(1)800평붓3": "908", "(1)800평붓4": "908", "(1)800평붓5": "908", "(1)800플로3": "978", "(1)800피스다보": "967", "(1)800피스톤630": "913", "(1)800피스톤CT64": "1240", "(1)800피스톤F30": "1195", "(1)800하폼건월드1": "1819", "(1)800하폼건월드2": "1818", "(1)800하폼건월드3": "1821", "(1)800하폼건월드4": "1857", "(1)800하폼건월드5": "1858", "(1)800하폼건월드8": "857", "(1)800하폼건월드9": "1859", "(1)800하폼크리너": "859", "(1)800핫멜트1심": "1244", "(1)800핫멜트건": "845", "(1)800핫팩": "1243", "(1)800행가노출2": "1160", "(1)800행가레일2": "1400", "(1)800행가양댐30": "1353", "(1)800행가양댐50": "1846", "(1)800행가양댐80": "1846", "(1)800행가하부촉": "1400", "(1)800헤라대": "964", "(1)800헤라소": "964", "(1)800헤라중": "964", "(1)800호스10": "1414", "(1)800호스20": "1414", "(1)800호스30": "1414", "(1)800호차30": "1781", "(1)A100뉴송11317": "836", "(1)A100뉴송21727": "836", "(1)A100뉴송32727": "836", "(1)800골판지테스트": "1866" };

// 실행 중 공유 상태
let G_TOKEN = '';
let G_CFG = null;
let G_SS = null;
let G_CONSEC_FAIL = 0;


// ════════════════════════════════════════════════════════
// ■ 메인 함수
// ════════════════════════════════════════════════════════

function syncPrices() {
    const start = new Date();
    const logs = [];
    let updated = 0, skipped = 0, errors = 0;
    const newMappingRows = [];
    const unmappedRows = [];
    let tokenRefreshFailed = false;

    try {
        // ── Step 1. 설정 로드 ─────────────────────────────────
        G_SS = getSpreadsheet();
        G_CFG = readConfig(G_SS);
        G_TOKEN = G_CFG[KEY.C24_ACCESS_TOKEN] || '';
        Logger.log(`Step1: 설정 로드 완료 | DRY_RUN=${G_CFG[KEY.DRY_RUN]}`);
        logs.push(`[${now()}] Step1: 설정 로드 완료`);

        // ── Step 2. 이카운트 가격 조회 ────────────────────────
        Logger.log('Step2: 이카운트 로그인...');
        const sessionId = ecLogin(G_CFG);
        const { prices: ecPrices, descriptions: ecDescriptions } = fetchEcountPrices(G_CFG, sessionId);
        Logger.log(`Step2: 이카운트 ${Object.keys(ecPrices).length}건 조회 완료`);
        logs.push(`[${now()}] Step2: 이카운트 ${Object.keys(ecPrices).length}건`);

        // ── Step 2.1 토큰 자동 갱신/사전 알림 ─────────────────
        try {
            const refreshed = ensureTokenRefreshIfNeeded_(G_SS, G_CFG);
            if (refreshed) {
                G_TOKEN = G_CFG[KEY.C24_ACCESS_TOKEN] || G_TOKEN;
                logs.push(`[${now()}] Step2.1: 토큰 자동 갱신 완료`);
            }
        } catch (te) {
            Logger.log('Step2.1: 토큰 갱신 실패 (기존 사용): ' + te.message);
            logs.push(`[${now()}] Step2.1: 토큰 갱신 실패 (기존 사용)`);
            tokenRefreshFailed = true;
            notifyAdmin_(G_CFG, `syncPrices 토큰 갱신 실패: ${te.message}\n재인증 필요: OAuth 재인증 후 새 토큰을 [설정] 시트에 반영하세요.`);
        }

        // ── Step 4. 매핑테이블 로드 ───────────────────────────
        Logger.log('Step4: 매핑테이블 로드...');
        const mappingCache = readMappingTable(G_SS);
        const cacheSize = Object.keys(mappingCache).length;
        Logger.log(`Step4: 매핑테이블 ${cacheSize}건 로드`);
        logs.push(`[${now()}] Step4: 매핑테이블 ${cacheSize}건 로드`);

        const mallId = G_CFG[KEY.C24_MALL_ID];
        const apiVer = G_CFG[KEY.C24_API_VERSION] || '2025-12-01';

        // ── Step4.1 카페24 캐시 상태 확인 ───────────────────
        if (!isCafe24CacheDone_()) {
            Logger.log('Step4.1: 카페24 캐시 미완성 → syncPrices 종료');
            logs.push(`[${now()}] Step4.1: 카페24 캐시 미완성`);
            writeLog(G_SS, start, updated, skipped, errors, logs.join('\n'));
            return;
        }

        const cafe24Cache = readCafe24SheetCache(G_SS);
        Logger.log(`Step4.1: 카페24 캐시 로드 ${Object.keys(cafe24Cache).length}건`);

        // 디버그: 특정 product_no 전체 목록 포함 여부 확인
        const debugProductNo = G_CFG[KEY.DEBUG_PRODUCT_NO];
        if (debugProductNo) {
            checkProductNoInCatalog(mallId, apiVer, debugProductNo);
        }

        // ── 전체 스캔 제거: 캐시 완료 상태에서만 동기화 진행 ────────
        if (cacheSize === 0) {
            Logger.log('Step4: 매핑테이블 비어있음 → 캐시 기반 자동등록에 의존');
            logs.push(`[${now()}] Step4: 매핑테이블 비어있음`);
        }

        // ── Step 5. 이카운트 가격과 매핑테이블 비교 → 변동 항목만 업데이트 ──
        Logger.log('Step5: 가격 변동 감지 및 타겟 업데이트 시작...');
        logs.push(`[${now()}] Step5: 타겟 업데이트 시작`);

        const entries = Object.entries(ecPrices);
        const startIdx = getSyncProgress_();
        Logger.log(`Step5: 진행 시작 인덱스=${startIdx}/${entries.length}`);

        for (let i = startIdx; i < entries.length; i++) {
            const [customCode, ecPrice] = entries[i];
            if (new Date() - start > TIME_LIMIT_MS) {
                Logger.log(`시간 제한 접근 (${((new Date() - start) / 1000).toFixed(0)}s) → 진행 상태 저장 후 중단`);
                logs.push(`[${now()}] 시간 제한으로 중단 (idx 저장)`);
                setSyncProgress_(i);
                break;
            }

            let entry = mappingCache[customCode];

            let autoRegistered = false;
            if (!entry) {
                // 매핑 없음 → 카페24 실시간 캐시에서 조회
                const auto = cafe24Cache[customCode];
                if (!auto) {
                    Logger.log(`미매핑: ${customCode} (카페24 캐시에도 없음)`);
                    newMappingRows.push([customCode, '', '', ecPrice, now(), '미매핑']);
                    const desc = (ecDescriptions && ecDescriptions[customCode]) ? ecDescriptions[customCode] : '';
                    unmappedRows.push([customCode, desc, now()]);
                    skipped++;
                    continue;
                }

                entry = {
                    productNo: String(auto.productNo),
                    variantCode: String(auto.variantCode),
                    cachedPrice: auto.cachedPrice,
                };
                mappingCache[customCode] = entry;
                autoRegistered = true;
                Logger.log(`자동등록: ${customCode} → product_no=${entry.productNo}, variant=${entry.variantCode}`);
            }

            const { productNo, variantCode, cachedPrice } = entry;
            const priceWithVat = Math.round(ecPrice * 1.1);

            // 가격 변동 없으면 스킵
            if (Math.round(cachedPrice) === priceWithVat) {
                newMappingRows.push([customCode, productNo, variantCode, cachedPrice, now(), autoRegistered ? '자동등록+스킵(변동없음)' : '스킵(변동없음)']);
                skipped++;
                continue;
            }

            Logger.log(`변동: ${customCode} | ${cachedPrice} → ${priceWithVat} (VAT 포함)`);
            logs.push(`[${now()}] 변동: ${customCode} | ${cachedPrice} → ${priceWithVat} (VAT 포함)`);

            if (G_CFG[KEY.DRY_RUN] === 'true') {
                newMappingRows.push([customCode, productNo, variantCode, priceWithVat, now(), autoRegistered ? '자동등록+DRY_RUN' : 'DRY_RUN']);
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
                    entry.cachedPrice = priceWithVat;
                    updated++;
                } else {
                    Logger.log(`단품 업데이트 실패: ${customCode} | status=${pRes.status}`);
                    logs.push(`  └ 실패(단품) (${pRes.status}): ${customCode}`);
                    newMappingRows.push([customCode, productNo, '', cachedPrice, now(), `실패(단품)(${pRes.status})`]);
                    errors++;
                }
                Utilities.sleep(DELAY_MS);
                continue;
            }

            // 카페24 직접 PUT (product_no + variant_code 사용)
            const url = `https://${mallId}.cafe24api.com/api/v2/admin/products/${productNo}/variants/${variantCode}`;
            const payload = { request: { variant: { additional_amount: String(priceWithVat) } } };
            const res = c24Put(url, apiVer, payload);

            if (res.ok) {
                Logger.log(`업데이트 성공: ${customCode} | product_no=${productNo} | variant=${variantCode} | ${cachedPrice} → ${priceWithVat} (${res.status})`);
                logs.push(`  └ 성공 (${res.status}): ${customCode}`);
                newMappingRows.push([customCode, productNo, variantCode, priceWithVat, now(), autoRegistered ? '자동등록+성공' : '성공']);
                entry.cachedPrice = priceWithVat;
                updated++;
            } else {
                Logger.log(`업데이트 실패: ${customCode} | status=${res.status} | ${res.body.substring(0, 80)}`);
                logs.push(`  └ 실패 (${res.status}): ${customCode}`);
                newMappingRows.push([customCode, productNo, variantCode, cachedPrice, now(), autoRegistered ? `자동등록+실패(${res.status})` : `실패(${res.status})`]);
                errors++;
            }

            Utilities.sleep(DELAY_MS);
        }

        clearSyncProgress_();

        // ── Step 6. 매핑테이블 갱신 ──────────────────────────
        if (newMappingRows.length > 0) {
            writeMappingTable(G_SS, newMappingRows);
            Logger.log(`Step6: 매핑테이블 ${newMappingRows.length}건 갱신`);
            logs.push(`[${now()}] Step6: 매핑테이블 ${newMappingRows.length}건 갱신`);
        }

        if (unmappedRows.length > 0) {
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

    // ── Step 7. 실행로그 기록 ─────────────────────────────
    const elapsed = ((new Date() - start) / 1000).toFixed(1);
    const summary = `[${now()}] 완료 — 업데이트:${updated} 스킵:${skipped} 오류:${errors} (${elapsed}s)`;
    logs.push(summary);
    Logger.log(summary);
    if (G_SS) writeLog(G_SS, start, updated, skipped, errors, logs.join('\n'));

    if (errors > 0) {
        notifyAdmin_(G_CFG, `syncPrices 오류 발생: ${errors}건\n${summary}`);
    }
}


// ════════════════════════════════════════════════════════
// ■ 자동 트리거 (1회 실행)
// ════════════════════════════════════════════════════════

function createTrigger() {
    const triggers = ScriptApp.getProjectTriggers();
    for (const t of triggers) {
        const fn = t.getHandlerFunction();
        if (fn === 'syncPrices' || fn === 'buildCafe24Cache' || fn === 'checkNewProducts') {
            ScriptApp.deleteTrigger(t);
        }
    }
    ScriptApp.newTrigger('buildCafe24Cache').timeBased().everyDays(1).create();
    ScriptApp.newTrigger('checkNewProducts').timeBased().everyHours(2).create();
    ScriptApp.newTrigger('syncPrices').timeBased().everyHours(1).create();
    Logger.log('✅ buildCafe24Cache 매일 1회, checkNewProducts 2시간마다, syncPrices 매 60분 자동 트리거가 생성되었습니다.');
}



// ════════════════════════════════════════════════════════
// ■ 카페24 API
// ════════════════════════════════════════════════════════

/** 401 감지 시 토큰 재발급 후 G_TOKEN 갱신 */
function tryRefreshAndRetry_() {
    Logger.log('[TokenRefresh] 401 감지. 토큰 재발급 시도...');
    const refreshed = refreshCafe24Token(G_CFG);
    G_TOKEN = refreshed.access_token;
    G_CFG[KEY.C24_ACCESS_TOKEN] = G_TOKEN;
    if (refreshed.refresh_token) G_CFG[KEY.C24_REFRESH_TOKEN] = refreshed.refresh_token;
    setConfig(G_SS, KEY.C24_ACCESS_TOKEN, G_TOKEN);
    if (refreshed.refresh_token) setConfig(G_SS, KEY.C24_REFRESH_TOKEN, refreshed.refresh_token);
    Logger.log('[TokenRefresh] 재발급 성공. 새 토큰 앞 15자: ' + G_TOKEN.substring(0, 15));
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
        try { tryRefreshAndRetry_(); const r2 = _rawGet(url, apiVersion, G_TOKEN);
            if (!r2.ok) recordApiFailure_(G_CFG, `GET 실패 status=${r2.status}`); else recordApiSuccess_();
            return r2;
        } catch (e) { Logger.log('[c24Get] 토큰 재발급 실패: ' + e.message); return res; }
    }
    if (!res.ok) recordApiFailure_(G_CFG, `GET 실패 status=${res.status}`); else recordApiSuccess_();
    return res;
}


/** PUT — 401 자동 재시도 */
function c24Put(url, apiVersion, payload) {
    const res = _rawPut(url, apiVersion, G_TOKEN, payload);
    if (res.status === 401) {
        try { tryRefreshAndRetry_(); const r2 = _rawPut(url, apiVersion, G_TOKEN, payload);
            if (!r2.ok) recordApiFailure_(G_CFG, `PUT 실패 status=${r2.status}`); else recordApiSuccess_();
            return r2;
        } catch (e) { Logger.log('[c24Put] 토큰 재발급 실패: ' + e.message); return res; }
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


/** Refresh Token → 새 Access Token */
function refreshCafe24Token(cfg) {
    const creds = Utilities.base64Encode(`${cfg[KEY.C24_CLIENT_ID]}:${cfg[KEY.C24_CLIENT_SECRET]}`);
    const res = UrlFetchApp.fetch(
        `https://${cfg[KEY.C24_MALL_ID]}.cafe24api.com/api/v2/oauth/token`,
        {
            method: 'POST',
            headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            payload: `grant_type=refresh_token&refresh_token=${cfg[KEY.C24_REFRESH_TOKEN]}`,
            muteHttpExceptions: true,
        }
    );
    const body = res.getContentText();
    Logger.log('[refreshCafe24Token] 응답: ' + body.substring(0, 150));
    const json = JSON.parse(body);
    if (!json.access_token) throw new Error('Token refresh 실패: ' + body);
    return json;
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
    return props.getProperty('C24_CACHE_DONE') === 'true';
}

/** 카페24 캐시 완료 플래그/오프셋 업데이트 */
function setCafe24CacheState_(done, nextOffset) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('C24_CACHE_DONE', done ? 'true' : 'false');
    if (done) {
        props.deleteProperty('C24_CACHE_OFFSET');
    } else {
        props.setProperty('C24_CACHE_OFFSET', String(nextOffset));
    }
}

/** 카페24상품 시트에서 캐시 로드 */
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
            cache[customCode] = { productNo, variantCode, cachedPrice: price };
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
    G_TOKEN = cfg[KEY.C24_ACCESS_TOKEN] || '';

    // 토큰 자동 갱신 시도
    try {
        const refreshed = ensureTokenRefreshIfNeeded_(ss, cfg);
        if (refreshed) G_TOKEN = cfg[KEY.C24_ACCESS_TOKEN] || G_TOKEN;
    } catch (e) {
        Logger.log('[checkNewProducts] 토큰 갱신 실패: ' + e.message);
        notifyAdmin_(cfg, `checkNewProducts 토큰 갱신 실패: ${e.message}`);
    }

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
            newMappings.push([prodCd, auto.productNo, auto.variantCode, auto.cachedPrice, now(), '자동등록(증분)']);
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
        writeUnmappedSheet(ss, newRows);
        Logger.log(`[checkNewProducts] 미매핑 ${newRows.length}건 기록`);
    }
}

function buildCafe24Cache() {
    const ss = getSpreadsheet();
    const cfg = readConfig(ss);
    G_CFG = cfg;
    G_SS = ss;
    G_TOKEN = cfg[KEY.C24_ACCESS_TOKEN] || '';

    // 토큰 자동 갱신 시도 (2시간 이내 만료)
    try {
        const refreshed = ensureTokenRefreshIfNeeded_(ss, cfg);
        if (refreshed) {
            G_TOKEN = cfg[KEY.C24_ACCESS_TOKEN] || G_TOKEN;
            Logger.log('[buildCafe24Cache] 토큰 자동 갱신 성공');
        }
    } catch (e) {
        Logger.log('[buildCafe24Cache] 토큰 갱신 실패 (기존 사용): ' + e.message);
        notifyAdmin_(cfg, `buildCafe24Cache 토큰 갱신 실패: ${e.message}\n재인증 필요: OAuth 재인증 후 새 토큰을 [설정] 시트에 반영하세요.`);
    }

    const mallId = cfg[KEY.C24_MALL_ID];
    const apiVer = cfg[KEY.C24_API_VERSION] || '2025-12-01';
    const props = PropertiesService.getScriptProperties();
    const offset = parseInt(props.getProperty('C24_CACHE_OFFSET') || '0', 10);
    const limit = 100;

    Logger.log(`[buildCafe24Cache] 상품 목록 조회 offset=${offset}, limit=${limit}`);
    const products = fetchCafe24ProductsPage_(mallId, apiVer, offset, limit);
    if (!products) {
        Logger.log('[buildCafe24Cache] 상품 목록 조회 실패');
        return;
    }

    const rows = [];
    for (const product of products) {
        const productNo = String(product.product_no || '');
        const productCode = String(product.product_code || '');
        const productName = String(product.product_name || '');
        if (!productNo) continue;
        const variants = fetchProductVariants(mallId, apiVer, productNo);
        for (const v of variants) {
            const customCode = String(v.custom_variant_code || '').trim();
            const variantCode = String(v.variant_code || '').trim();
            const price = parseFloat(String(v.additional_amount || '0').replace(/,/g, '')) || 0;
            rows.push([productNo, productCode, productName, customCode, variantCode, price]);
        }
    }

    writeCafe24SheetBatch(ss, rows, offset === 0);
    Logger.log(`[buildCafe24Cache] rows=${rows.length} 기록 완료`);

    if (products.length < limit) {
        setCafe24CacheState_(true, 0);
        Logger.log('[buildCafe24Cache] 캐시 완료');
    } else {
        setCafe24CacheState_(false, offset + limit);
        Logger.log(`[buildCafe24Cache] 캐시 진행중 → 다음 offset=${offset + limit}`);
    }
}

/** 카페24 상품 목록 페이지 조회 */
function fetchCafe24ProductsPage_(mallId, apiVersion, offset, limit) {
    const url = `https://${mallId}.cafe24api.com/api/v2/admin/products?limit=${limit}&offset=${offset}&fields=product_no,product_code,product_name`;
    const res = c24Get(url, apiVersion);
    if (!res.ok) {
        Logger.log('상품 목록 조회 오류: ' + res.status + ' ' + res.body.substring(0, 100));
        return null;
    }
    return JSON.parse(res.body).products || [];
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
            if (status === 401 && attempt === 1) { try { tryRefreshAndRetry_(); } catch (_) { } continue; }
            if (status < 200 || status >= 300) {
                Logger.log(`Variants 오류 (attempt=${attempt}): product=${productNo} status=${status}`);
                if (attempt < 2) { Utilities.sleep(3000); continue; }
                return [];
            }
            return JSON.parse(body).variants || [];
        } catch (e) {
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
        if (cd.includes('(1)') && des.includes('◈')) {
            map[cd] = parseFloat(String(item[priceField] || '0').replace(/,/g, '')) || 0;
            descMap[cd] = des;
        }
    }
    return { prices: map, descriptions: descMap };
}

function post(url, payload) {
    const res = UrlFetchApp.fetch(url, {
        method: 'POST', contentType: 'application/json',
        payload: JSON.stringify(payload), muteHttpExceptions: true,
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
 * [매핑테이블] 시트 읽기
 * 헤더: custom_variant_code | product_no | variant_code | cached_price | 최근업데이트 | 결과
 * @returns {{ [customCode]: { productNo, variantCode, cachedPrice } }}
 */
function readMappingTable(ss) {
    const sh = ss.getSheetByName(SH.MAPPING);
    const cache = {};
    if (!sh) return cache;
    const data = sh.getDataRange().getValues();
    if (data.length <= 1) return cache; // 헤더만 있거나 비어있음
    for (let i = 1; i < data.length; i++) { // 1행부터 (0행=헤더)
        const code = String(data[i][0] || '').trim();
        const productNo = String(data[i][1] || '').trim();
        const varCode = String(data[i][2] || '').trim();
        const price = parseFloat(String(data[i][3] || '0').replace(/,/g, '')) || 0;
        if (code && productNo) {
            cache[code] = { productNo, variantCode: varCode, cachedPrice: price };
        }
    }
    return cache;
}

/** [매핑테이블] 시트 전체 갱신 */
function writeMappingTable(ss, rows) {
    const sh = ss.getSheetByName(SH.MAPPING);
    if (!sh) { Logger.log('⚠️ [매핑테이블] 시트 없음'); return; }
    const header = ['custom_variant_code', 'product_no', 'variant_code', 'cached_price', '최근업데이트', '결과'];
    sh.clearContents();
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    if (rows.length > 0) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
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

function writeLog(ss, start, updated, skipped, errors, detail) {
    const sh = ss.getSheetByName(SH.LOG);
    if (!sh) return;
    sh.appendRow([
        Utilities.formatDate(start, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
        updated, skipped, errors, detail,
    ]);
}


// syncPrices 진행 상태 저장
function getSyncProgress_() {
    const props = PropertiesService.getScriptProperties();
    return parseInt(props.getProperty('SYNC_PROGRESS_IDX') || '0', 10);
}
function setSyncProgress_(idx) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('SYNC_PROGRESS_IDX', String(idx));
}
function clearSyncProgress_() {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty('SYNC_PROGRESS_IDX');
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

// 토큰 자동 갱신 및 만료 사전 알림
function ensureTokenRefreshIfNeeded_(ss, cfg) {
    if (!cfg) return false;

    const accessExp = cfg[KEY.TOKEN_EXPIRES_AT];
    const refreshExp = cfg[KEY.REFRESH_EXPIRES_AT];
    const now = new Date();

    const parseDate = (v) => {
        if (!v) return null;
        const dt = new Date(String(v));
        return isNaN(dt.getTime()) ? null : dt;
    };

    const accessDt = parseDate(accessExp);
    const refreshDt = parseDate(refreshExp);

    // refresh_token 만료 7일 전 경고
    if (refreshDt) {
        const daysLeft = Math.ceil((refreshDt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft === 7) {
            notifyAdmin_(cfg, `Refresh token 만료 7일 전 경고: (${refreshExp})\n재인증 준비 필요`);
        }
        if (daysLeft <= 0) {
            notifyAdmin_(cfg, `Refresh token 만료됨 (${refreshExp})\n재인증 필요: OAuth 재인증 후 새 토큰을 [설정] 시트에 반영하세요.`);
        }
    }

    // access_token 만료 2시간 전이면 자동 갱신
    if (accessDt) {
        const hoursLeft = (accessDt.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursLeft <= 2) {
            const r = refreshCafe24Token(cfg);
            cfg[KEY.C24_ACCESS_TOKEN] = r.access_token;
            if (r.refresh_token) cfg[KEY.C24_REFRESH_TOKEN] = r.refresh_token;
            setConfig(ss, KEY.C24_ACCESS_TOKEN, r.access_token);
            if (r.refresh_token) setConfig(ss, KEY.C24_REFRESH_TOKEN, r.refresh_token);
            if (r.expires_at) setConfig(ss, KEY.TOKEN_EXPIRES_AT, r.expires_at);
            if (r.refresh_token_expires_at) setConfig(ss, KEY.REFRESH_EXPIRES_AT, r.refresh_token_expires_at);
            Logger.log('자동 토큰 갱신 완료 (2시간 이내 만료)');
            return true;
        }
    }
    return false;
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

// 특정 품목의 cached_price 출력 (매핑테이블)
function printCachedPrice() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('매핑테이블');
    if (!sh) { Logger.log('[printCachedPrice] 매핑테이블 시트 없음'); return; }
    const data = sh.getDataRange().getValues();
    if (data.length <= 1) { Logger.log('[printCachedPrice] 데이터 없음'); return; }

    const header = data[0].map(h => String(h || ''));
    const idxCode = header.indexOf('custom_variant_code');
    const idxCached = header.indexOf('cached_price');

    if (idxCode < 0 || idxCached < 0) {
        Logger.log('[printCachedPrice] 컬럼 인덱스 찾기 실패');
        Logger.log('[printCachedPrice] 헤더: ' + header.join(' | '));
        return;
    }

    for (let i = 1; i < data.length; i++) {
        if (String(data[i][idxCode]).trim() === '(1)200자이02방수936') {
            Logger.log(`cached_price=${data[i][idxCached]}`);
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
    G_TOKEN = cfg[KEY.C24_ACCESS_TOKEN] || '';

    // 토큰 갱신
    try {
        const r = refreshCafe24Token(cfg);
        G_TOKEN = r.access_token;
        setConfig(ss, KEY.C24_ACCESS_TOKEN, G_TOKEN);
        G_CFG[KEY.C24_ACCESS_TOKEN] = G_TOKEN;
        if (r.refresh_token) {
            setConfig(ss, KEY.C24_REFRESH_TOKEN, r.refresh_token);
            G_CFG[KEY.C24_REFRESH_TOKEN] = r.refresh_token;
        }
        Logger.log('[setCustomVariantCodes] 토큰 갱신 성공');
    } catch (e) {
        Logger.log('[setCustomVariantCodes] 토큰 갱신 실패 (기존 사용): ' + e.message);
    }

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
