# Painel de Livros (PocketBase)

Painel web para gerenciar a coleção `livros` no PocketBase com upload de arquivos e capa.

## Rodar sem Docker

```bash
cd web
python3 -m http.server 9090
```

Acesso local:

```bash
http://localhost:9090
```

Se não tiver `python3`, use:

```bash
cd web
python -m http.server 9090
```

Ou com Node:

```bash
npx serve web -l 9090
```

## Funcionalidades

- Login no PocketBase via `_superusers`
- Listagem de livros
- Filtro por autor/gênero/sinopse
- Criação de livro com:
  - arquivo(s) em vários formatos
  - capa
  - autor (opcional)
  - sinopse
  - páginas (opcional)
  - gênero
  - avaliação (opcional)
- Exclusão de livro
