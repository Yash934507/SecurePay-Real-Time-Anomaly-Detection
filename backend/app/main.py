import os
import math
import re
from ipaddress import ip_address
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, field_validator
from starlette.responses import JSONResponse

from app.batch_csv import BatchCsvValidationError, parse_transaction_csv
from app.ml_service import (
    MODEL_FEATURES,
    ModelArtifactsUnavailable,
    get_prediction_service,
)

MAX_BATCH_UPLOAD_BYTES = int(os.getenv("SECUREPAY_MAX_UPLOAD_BYTES", 5 * 1024 * 1024))
MAX_BATCH_ROWS = int(os.getenv("SECUREPAY_MAX_BATCH_ROWS", 10_000))
MULTIPART_OVERHEAD_BYTES = 64 * 1024

if MAX_BATCH_UPLOAD_BYTES <= 0 or MAX_BATCH_ROWS <= 0:
    raise RuntimeError("Batch upload byte and row limits must be positive integers.")


DEVELOPMENT_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)


def parse_cors_origins(value: str) -> list[str]:
    """Accept exact HTTP(S) origins only; invalid configuration fails startup."""
    origins = list(DEVELOPMENT_CORS_ORIGINS)
    for entry in value.split(","):
        origin = entry.strip()
        if not origin:
            continue
        match = re.fullmatch(
            r"https?://(?P<host>\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9.-]+)(?::(?P<port>[0-9]{1,5}))?",
            origin,
        )
        valid = match is not None
        if match:
            host, port = match.group("host", "port")
            if port is not None and not 1 <= int(port) <= 65535:
                valid = False
            if host.startswith("[") or re.fullmatch(r"[0-9.]+", host):
                try:
                    address = ip_address(host.strip("[]"))
                    if host.startswith("[") and address.version != 6:
                        valid = False
                except ValueError:
                    valid = False
            else:
                valid = valid and len(host) <= 253 and all(
                    re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?", label)
                    for label in host.split(".")
                )
        if not valid:
            # Do not echo potentially sensitive configuration into startup logs.
            raise RuntimeError(
                "Invalid SECUREPAY_CORS_ORIGINS entry: use exact http:// or https:// origins "
                "with a valid host and optional port, without wildcards, credentials, "
                "paths, trailing slashes, queries, or fragments."
            )
        if origin not in origins:
            origins.append(origin)
    return origins


CORS_ORIGINS = parse_cors_origins(os.getenv("SECUREPAY_CORS_ORIGINS", ""))


class BatchUploadSizeLimitMiddleware:
    def __init__(self, app, max_bytes):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] != "http"
            or scope["method"] != "POST"
            or scope["path"] != "/predict/batch"
        ):
            await self.app(scope, receive, send)
            return

        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        content_length = headers.get(b"content-length")
        if content_length is not None:
            try:
                request_size = int(content_length)
            except ValueError:
                response = JSONResponse(status_code=400, content={"detail": "Invalid Content-Length header."})
                await response(scope, receive, send)
                return
            if request_size > self.max_bytes:
                response = JSONResponse(
                    status_code=413,
                    content={"detail": "Upload exceeds the configured request size limit."},
                )
                await response(scope, receive, send)
                return

        body_chunks = []
        body_size = 0
        more_body = True
        while more_body:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            if message["type"] != "http.request":
                continue

            chunk = message.get("body", b"")
            body_size += len(chunk)
            if body_size > self.max_bytes:
                response = JSONResponse(
                    status_code=413,
                    content={"detail": "Upload exceeds the configured request size limit."},
                )
                await response(scope, receive, send)
                return
            body_chunks.append(chunk)
            more_body = message.get("more_body", False)

        request_body = b"".join(body_chunks)
        body_sent = False

        async def replay_receive():
            nonlocal body_sent
            if not body_sent:
                body_sent = True
                return {"type": "http.request", "body": request_body, "more_body": False}
            return await receive()

        await self.app(scope, replay_receive, send)


app = FastAPI(title="SecurePay API")
app.add_middleware(
    BatchUploadSizeLimitMiddleware,
    max_bytes=MAX_BATCH_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(request: Request, error: RequestValidationError):
    details = [
        {
            "loc": list(item.get("loc", ())),
            "msg": item.get("msg", "Invalid request."),
            "type": item.get("type", "value_error"),
        }
        for item in error.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": details})


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: Literal["isolation_forest", "lof"] = "lof"
    V1: float
    V2: float
    V3: float
    V4: float
    V5: float
    V6: float
    V7: float
    V8: float
    V9: float
    V10: float
    V11: float
    V12: float
    V13: float
    V14: float
    V15: float
    V16: float
    V17: float
    V18: float
    V19: float
    V20: float
    V21: float
    V22: float
    V23: float
    V24: float
    V25: float
    V26: float
    V27: float
    V28: float
    Amount: float

    @field_validator(*MODEL_FEATURES, mode="before")
    @classmethod
    def require_finite_json_numbers(cls, value):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("Feature values must be finite JSON numbers.")
        if not math.isfinite(value):
            raise ValueError("Feature values must be finite JSON numbers.")
        return float(value)

    @field_validator("Amount")
    @classmethod
    def require_nonnegative_amount(cls, value):
        if value < 0:
            raise ValueError("Amount must be nonnegative.")
        return value


@app.get("/")
async def root():
    return {"message": "Welcome to the SecurePay API."}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "SecurePay API"}


@app.post("/predict")
async def predict(request: PredictionRequest):
    try:
        service = get_prediction_service()
        return service.predict(request.model_dump(exclude={"model"}), request.model)
    except ModelArtifactsUnavailable:
        raise HTTPException(
            status_code=503,
            detail="Prediction service is unavailable because model artifacts could not be loaded.",
        ) from None


@app.post("/predict/batch")
async def predict_batch(
    file: UploadFile = File(...),
    model: Literal["isolation_forest", "lof"] = Form("lof"),
):
    try:
        if not file.filename or not file.filename.lower().endswith(".csv"):
            raise HTTPException(status_code=415, detail="Upload a file with a .csv extension.")

        content_type = (file.content_type or "").split(";", maxsplit=1)[0].strip().lower()
        allowed_content_types = {
            "",
            "text/csv",
            "application/csv",
            "application/vnd.ms-excel",
            "application/octet-stream",
        }
        if content_type not in allowed_content_types:
            raise HTTPException(status_code=415, detail="Only CSV uploads are supported.")

        content = await file.read(MAX_BATCH_UPLOAD_BYTES + 1)
        if len(content) > MAX_BATCH_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Upload exceeds the {MAX_BATCH_UPLOAD_BYTES // (1024 * 1024)} MiB limit.",
            )

        service = get_prediction_service()
        feature_matrix = parse_transaction_csv(
            content,
            MAX_BATCH_ROWS,
            service.feature_names,
        )
        return service.predict_batch(feature_matrix, model)
    except BatchCsvValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    except ModelArtifactsUnavailable:
        raise HTTPException(
            status_code=503,
            detail="Prediction service is unavailable because model artifacts could not be loaded.",
        ) from None
    finally:
        await file.close()