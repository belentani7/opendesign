# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities via email to belentani7pedro@gmail.com.

## Code Scanning

This project uses GitHub CodeQL for automated security scanning. All security issues detected by CodeQL will be addressed with priority.

## Dependabot

Dependabot alerts security vulnerabilities in dependencies. Dependabot security updates will be accepted via Pull Request.

## Secret Protection

GitHub Secret Protection scans for hardcoded secrets. Do not commit API keys, tokens, or passwords to this repository.

## Advanced Security

Enable GitHub Advanced Security for:
- Dependabot alerts
- CodeQL analysis
- Secret scanning
- Push protection

<!-- repo-forge:security:inicio -->
# Seguridad

## Reportar una vulnerabilidad

No abras un issue público. Usa el canal privado de GitHub Security del repositorio.
Incluye: versión o commit, pasos para reproducir, impacto y, si puedes, una corrección.

## Qué se considera vulnerabilidad

- Ejecución de código o comandos no previstos.
- Lectura o escritura de archivos fuera del alcance declarado.
- Exposición de credenciales en logs, informes o manifiestos.
- Dependencia con CVE conocido en una ruta ejecutable.

## Reglas del proyecto

- Ningún secreto se escribe en disco, en un log ni en un informe.
- Toda operación de escritura requiere `--apply` explícito.
- Las operaciones destructivas están bloqueadas por diseño.

<!-- repo-forge:security -->
<!-- repo-forge:security:fin -->
