import time
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

# Initialize request limiter: 100 requests per minute per IP
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(429, _rate_limit_exceeded_handler)

# CORS configuration – restrict to allowed origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://myra.example.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Secure headers middleware
class SecureHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        # Content Security Policy – adjust sources as needed
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self' data:; font-src https://fonts.gstatic.com"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

app.add_middleware(SecureHeadersMiddleware)

# OAuth2 placeholder – replace with real JWT verification
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")

def verify_token(token: str | None = None):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # TODO: decode & validate JWT, check scopes, expiration, etc.
    return True

@app.get("/secure-data")
@limiter.limit("10/minute")
async def secure_endpoint(request: Request, token: str = None):
    verify_token(token)
    return {"msg": "Protected data", "timestamp": time.time()}
