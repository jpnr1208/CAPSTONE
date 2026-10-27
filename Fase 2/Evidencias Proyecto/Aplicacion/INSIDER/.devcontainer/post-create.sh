#!/usr/bin/env bash
# Instalación automática de dependencias al crear el Codespace.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ Backend: creando entorno virtual e instalando dependencias (pip install)…"
cd "$ROOT/backend"
python -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt
[ -f .env ] || cp .env.example .env

echo "▶ Frontend: instalando dependencias (npm install)…"
cd "$ROOT/frontend"
npm install
[ -f .env ] || cp .env.example .env

echo "✔ Entorno listo. Revisa README.md para migrar, cargar datos semilla y levantar los servidores."
