# Fase 0 - Decisiones congeladas

Este documento congela las decisiones de la Fase 0 para iniciar implementacion de CLI (Fase 1) sin ambiguedades.

## 1) Nombre final del paquete

- `package.json:name`: `senflow`

## 2) Fuente oficial para instalador remoto

- Organizacion/usuario GitHub: `fabianrod`
- Repositorio: `senflow`
- Ref inicial para instalador raw: `main`
- URL base definida:
  - `https://raw.githubusercontent.com/fabianrod/senflow/main/install.sh`

## 3) Version minima oficial de runtime

- Node.js: `>=20.11.0`
- npm: `>=10.2.0`

Razon breve:
- Compatibilidad estable con toolchain actual (`Next.js`, `Prisma`, `better-sqlite3`).
- Alineado con lockfile v3 y flujo moderno de npm.

## 4) Criterio de salida Fase 0

Se considera Fase 0 completada cuando:
- el naming esta fijado a `senflow`,
- la URL raw base esta definida con org/repo/ref inicial,
- y las versiones minimas oficiales de Node/npm estan documentadas y reflejadas en el proyecto.
