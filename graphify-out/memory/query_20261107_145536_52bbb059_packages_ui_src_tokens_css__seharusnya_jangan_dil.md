---
type: "query"
date: "2026-11-07T14:55:36.516014+00:00"
question: "`packages/ui/src/tokens.css` seharusnya jangan dilewati. lalu docs\\testing dan `AppError` apakah itu penting sehingga harus dimasukkan dalam graph?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["AppError", "tokens.css", "styles.css"]
---

# Q: `packages/ui/src/tokens.css` seharusnya jangan dilewati. lalu docs\testing dan `AppError` apakah itu penting sehingga harus dimasukkan dalam graph?

## Answer

Expanded from original query via graph vocabulary: [error, audit, screenshot, theme, tokens, validation, failure]. tokens.css was a filename-sensitive false positive and CSS is unsupported by the AST parser. Included it using an explicit semantic fragment plus styles.css import links. User chose to exclude docs/testing from the main graph; removed 529 evidence nodes and persisted docs/testing/ in .graphifyignore. AppError remains a shared status/message/code contract at packages/contracts/src/index.ts L210, handled by failure() at packages/server/src/index.ts L6, with 91 relationships across Auth, Bag Filter, Consumables, and server APIs. Its cluster reflects its consumers. The updated graph has 1493 nodes and 3907 edges.

## Outcome

- Signal: useful

## Source Nodes

- AppError
- tokens.css
- styles.css