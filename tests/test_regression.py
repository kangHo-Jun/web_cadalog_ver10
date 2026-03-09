import pytest, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

def test_T4_detect_changes_accuracy():
    from sync_engine import detect_changes
    old = {'A': 1000, 'B': 2000, 'C': 3000}
    new = {'A': 1500, 'B': 2000, 'D': 4000}
    result = detect_changes(old, new)
    assert result['changed'] == {'A': 1500}
    assert result['added']   == {'D': 4000}
    assert result['removed'] == {'C': 3000}
