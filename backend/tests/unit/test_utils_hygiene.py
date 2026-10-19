import pytest

pytestmark = pytest.mark.unit


def test_enable_email_is_bool():
    from app.core import config

    assert isinstance(config.settings.enable_email, bool)
