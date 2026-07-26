# Explicit Node version, because inferring it went wrong twice.
#
# Nixpacks is supposed to read `engines.node` or `.nvmrc`, and on this project
# it kept falling back to its built-in Node 18 default, which Next 16 refuses
# to build on. A Dockerfile removes the inference step: the base image *is* the
# answer, and it behaves the same on Railway, locally, and anywhere else.
FROM node:22-alpine

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies first, in their own layer, so a source-only change doesn't
# reinstall the world.
COPY package.json package-lock.json ./

# `npm ci` while NODE_ENV is still unset: setting it to production here would
# skip devDependencies, and the build needs TypeScript and Tailwind.
RUN npm ci

COPY . .

RUN npm run build

# Set only after the build, for the runtime process.
ENV NODE_ENV=production

# Next binds to $PORT when the platform sets one, and 3000 otherwise.
EXPOSE 3000

# devDependencies are intentionally kept: `npm run db:migrate` runs as the
# pre-deploy step in this same image and needs drizzle-orm and postgres
# resolvable from /app/node_modules.
CMD ["npm", "run", "start"]
