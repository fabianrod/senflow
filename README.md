# SenFlow

Aplicacion local para gestionar campanas de WhatsApp construida con Next.js, Prisma y SQLite.

## Requisitos previos

- Node.js `>=20.11.0`
- npm `>=10.2.0`

## Flujo recomendado (launcher global)

1) Instala el launcher:

```bash
curl -fsSL https://raw.githubusercontent.com/fabianrod/senflow/main/install.sh | bash
```

2) Prepara el entorno local de la app:

```bash
senflow install
```

3) Ejecuta SenFlow en produccion:

```bash
senflow run
```

## Que hace cada comando

### `senflow install`

Prepara el proyecto para uso local sin pasos manuales:

- instala dependencias (`npm install`)
- crea `.env` desde `.env.example` si no existe
- asegura `DATABASE_URL="file:./data/app.db"`
- genera `AUTH_SESSION_SECRET` si falta o esta en placeholder
- crea carpeta `data/`
- ejecuta Prisma (`npm run db:generate` y `npm run db:migrate`)

### `senflow run`

Ejecuta SenFlow en modo produccion por defecto:

- valida setup minimo
- si falta setup, ejecuta `senflow install` automaticamente
- genera build (`npm run build`) solo si no existe
- arranca servidor (`npm run start`)
- espera healthcheck y abre navegador automaticamente

Variables utiles:

- `PORT=3010 senflow run` para cambiar puerto
- `SENFLOW_DISABLE_BROWSER=1 senflow run` para no abrir navegador

## Instalacion manual (modo repo local)

Si prefieres ejecutar desde este repositorio:

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run dev
```

## Scripts disponibles

- `npm run dev`: inicia el servidor de desarrollo de Next.js.
- `npm run build`: genera el build de produccion.
- `npm run start`: levanta la app con el build de produccion.
- `npm run lint`: ejecuta ESLint.
- `npm run db:migrate`: aplica migraciones con Prisma.
- `npm run db:generate`: genera el cliente de Prisma.
- `npm run db:seed`: ejecuta el seed configurado en Prisma.
- `npm run senflow`: ejecuta la CLI local (`node ./bin/senflow.js`).

## Notas

- SenFlow guarda SQLite en `data/app.db`.
- Los archivos SQLite estan ignorados en git.
- Si cambias el esquema de Prisma, vuelve a ejecutar migraciones y `db:generate`.
