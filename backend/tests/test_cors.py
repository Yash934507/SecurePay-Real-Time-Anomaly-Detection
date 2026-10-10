import importlib.util
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.main as main


def configured_app(monkeypatch, value):
    if value is None:
        monkeypatch.delenv("SECUREPAY_CORS_ORIGINS", raising=False)
    else:
        monkeypatch.setenv("SECUREPAY_CORS_ORIGINS", value)
    spec = importlib.util.spec_from_file_location("securepay_cors_test_app", Path(main.__file__))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("value", [None, "", " , , "])
def test_default_cors_origins(monkeypatch, value):
    module = configured_app(monkeypatch, value)
    assert module.CORS_ORIGINS == list(main.DEVELOPMENT_CORS_ORIGINS)
    with TestClient(module.app) as client:
        for origin in main.DEVELOPMENT_CORS_ORIGINS:
            response = client.options("/predict", headers={
                "Origin": origin, "Access-Control-Request-Method": "POST",
            })
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == origin
            assert "access-control-allow-credentials" not in response.headers


def test_configured_origins_are_exact_and_deduplicated(monkeypatch):
    production = "https://securepay-demo.vercel.app"
    custom = "https://demo.example.org:8443"
    module = configured_app(monkeypatch, f"  {production}, ,{custom}, {production},http://localhost:5173,")
    assert module.CORS_ORIGINS == [*main.DEVELOPMENT_CORS_ORIGINS, production, custom]
    with TestClient(module.app) as client:
        for origin in module.CORS_ORIGINS:
            preflight = client.options("/predict", headers={
                "Origin": origin, "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            })
            assert preflight.status_code == 200
            assert preflight.headers["access-control-allow-origin"] == origin
            actual = client.get("/health", headers={"Origin": origin})
            assert actual.headers["access-control-allow-origin"] == origin
            assert "access-control-allow-credentials" not in actual.headers
        for origin in ["https://other.vercel.app", "https://securepay-demo.vercel.app.evil.example",
                       "http://securepay-demo.vercel.app", "https://demo.example.org", "null"]:
            preflight = client.options("/predict", headers={
                "Origin": origin, "Access-Control-Request-Method": "POST",
            })
            assert preflight.status_code == 400
            assert "access-control-allow-origin" not in preflight.headers
            assert "access-control-allow-origin" not in client.get("/health", headers={"Origin": origin}).headers


@pytest.mark.parametrize("invalid", [
    "*", "https://*.vercel.app", "https://securepay*.vercel.app", "null",
    "securepay-demo.vercel.app", "ftp://demo.example", "https://",
    "https://user:password@demo.example", "https://demo.example/",
    "https://demo.example/path", "https://demo.example?query", "https://demo.example#fragment",
    "https://demo.example:", "https://demo.example:0", "https://demo.example:65536",
    "https://demo.example:abc", "https://bad host.example", "https://demo\n.example",
    "https://bad_host.example", "https://-bad.example", "https://bad..example",
    "https://999.1.1.1", "https://[::::]", "https://[127.0.0.1]", "https://demo.example\\evil",
    "https://demo.example%2fevil", "https://" + "a" * 64 + ".example",
])
def test_invalid_origin_fails_startup_even_with_valid_entries(monkeypatch, invalid):
    with pytest.raises(RuntimeError, match="Invalid SECUREPAY_CORS_ORIGINS entry"):
        configured_app(monkeypatch, f"https://securepay-demo.vercel.app,{invalid}")


def test_valid_ip_origins():
    assert main.parse_cors_origins("http://192.0.2.1:8000,https://[::1]:8443")[-2:] == [
        "http://192.0.2.1:8000", "https://[::1]:8443",
    ]


@pytest.mark.parametrize("model", ["lof", "isolation_forest"])
def test_predictions_work_with_production_cors(monkeypatch, model):
    origin = "https://securepay-demo.vercel.app"
    module = configured_app(monkeypatch, origin)
    features = {f"V{i}": 0.0 for i in range(1, 29)}
    features["Amount"] = 10.0
    csv = ",".join(features) + "\n" + ",".join(str(value) for value in features.values()) + "\n"
    with TestClient(module.app) as client:
        single = client.post("/predict", json={"model": model, **features}, headers={"Origin": origin})
        batch = client.post("/predict/batch", data={"model": model},
                            files={"file": ("cors-test.csv", csv.encode(), "text/csv")},
                            headers={"Origin": origin})
        for response in [single, batch]:
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == origin
            assert "access-control-allow-credentials" not in response.headers
        assert batch.json()["results"][0]["prediction"] == single.json()["prediction"]
        assert batch.json()["results"][0]["threshold"] == single.json()["threshold"]
