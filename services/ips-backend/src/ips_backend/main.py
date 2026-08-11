import uvicorn

from src.ips_backend.config.loader.settings import app_settings

if __name__ == "__main__":
    service_config = app_settings().service
    uvicorn.run(
        "src.ips_backend.app.app:app",
        host=service_config.host,
        port=service_config.port,
        timeout_keep_alive=service_config.timeout_keep_alive,
        timeout_graceful_shutdown=service_config.timeout_graceful_shutdown,
        reload=service_config.reload,
        reload_dirs=["src"],
    )
