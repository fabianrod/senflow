# SenFlow

Aplicacion local para gestionar campanas de WhatsApp construida con Next.js, Prisma y SQLite.

## Requisitos previos

- Node.js 20 o superior
- npm 10 o superior

## Instalacion

1. Clona el repositorio e ingresa al directorio del proyecto.
2. Instala las dependencias:

```bash
npm install
```

3. Crea el archivo de entorno a partir del ejemplo:

```bash
cp .env.example .env
```

4. Revisa y ajusta las variables en `.env`:

```env
DATABASE_URL="file:./data/app.db"
AUTH_SESSION_SECRET="define-un-secreto-largo-en-local"
```

## Preparar base de datos

Ejecuta las migraciones y genera el cliente de Prisma:

```bash
npm run db:migrate
npm run db:generate
```

Opcionalmente, puedes correr el seed (actualmente no inserta datos por defecto):

```bash
npm run db:seed
```

## Ejecutar en desarrollo

```bash
npm run dev
```

La app quedara disponible en [http://localhost:3000](http://localhost:3000).

## Build de produccion

```bash
npm run build
npm run start
```

## Scripts disponibles

- `npm run dev`: inicia el servidor de desarrollo de Next.js.
- `npm run build`: genera el build de produccion.
- `npm run start`: levanta la app con el build de produccion.
- `npm run lint`: ejecuta ESLint.
- `npm run db:migrate`: aplica migraciones con Prisma.
- `npm run db:generate`: genera el cliente de Prisma.
- `npm run db:seed`: ejecuta el seed configurado en Prisma.

## Notas

- El proyecto usa SQLite y guarda los datos en `data/app.db`.
- Si cambias el esquema de Prisma, vuelve a ejecutar migraciones y `db:generate`.
