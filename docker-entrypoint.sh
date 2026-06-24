#!/bin/sh
set -e

echo "Applying migrations..."
npx prisma migrate deploy

echo "Seeding database (synthetic data + viewer/admin users)..."
npm run db:seed

echo "Starting Next.js dev server on 0.0.0.0:3000..."
exec npm run dev -- -H 0.0.0.0 -p 3000
