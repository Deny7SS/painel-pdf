# Painel Administrativo - Biblioteca PDF

Este é o painel web para gerenciar sua biblioteca de PDFs hospedada no PocketBase.

## 🚀 Como fazer Deploy no Vercel

1. **Crie uma conta no Vercel** (se não tiver): [vercel.com](https://vercel.com)
2. **Instale o Vercel CLI** (opcional, mas recomendado):
   ```bash
   npm i -g vercel
   ```
3. **Faça o Deploy**:
   - Abra o terminal na pasta deste projeto.
   - Digite `vercel` e aperte Enter.
   - Siga as instruções na tela (pode aceitar os padrões).

Ou, se preferir usar o GitHub:
1. Suba este código para um repositório no GitHub.
2. No painel do Vercel, clique em "Add New Project" e importe seu repositório.
3. Nas configurações do projeto no Vercel:
   - **Root Directory**: Deixe em branco (o `vercel.json` cuida disso) OU coloque `web` se preferir ignorar o `vercel.json`.
   - O resto deixe como padrão.

## 🛠️ Tecnologias
- HTML5, CSS3, JavaScript (Vanilla)
- PocketBase (Backend)
- Google Books API (Metadados)

## 📦 Estrutura
- `/web`: Contém o código do site (index.html, app.js, styles.css)
- `/scripts`: Scripts auxiliares para configurar o banco de dados
