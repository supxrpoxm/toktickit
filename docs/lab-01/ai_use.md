# Lab 1 — AI Use and Reflection

**LLM/agent used:** Gemini (Pair-programming & troubleshooting) and VS Code AI Agent (Code generation)

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | "Generate code for Issue 4: Create GET /api/categories using Prisma, update App.tsx to display list, and un-skip UI tests." | Reviewed the generated code, ran `npm run test` which passed successfully, and pushed it to GitHub. |
| 2 | "Error: listen EADDRINUSE: address already in use 0.0.0.0:3000" | Used the suggested `npx kill-port 3000` command to forcefully close the hanging Node.js background process. |
| 3 | "git checkout feature/4-category-api error: pathspec did not match any file(s) known to git" | Realized I created the branch on GitHub UI, so I ran `git fetch` first to sync remote branches as advised. |
| 4 | "Deletion of directory 'server/prisma/migrations/...' failed. Should I try again? (y/n)" | Understood it was a Windows file lock issue. I terminated the batch job (`Ctrl+C`) and used `taskkill /F /IM node.exe`. |
| 5 | "How to review PR for Issue 1? The GitHub page says 'No changes to show'." | Realized my partner forgot to push their code. I asked them to run `git push` locally before I proceeded with the review. |
| 6 | "error: Your local changes to the following files would be overwritten by checkout: .gitignore" | Used the `git stash` command suggested by the AI to temporarily save my uncommitted changes before switching branches. |
| 7 | "Help me write professional code review comments in Thai for my partner's PRs (Issue 2, 3, 4)." | Copied and pasted the generated summaries into the GitHub PR 'Review changes' section, checked the requirements, and approved them. |

## Reflection
Providing exact error logs (like `EADDRINUSE`) and specific file names (`App.tsx`, `App.test.tsx`) made the AI's solutions much more accurate and immediately applicable. However, I had to correct the AI when it assumed I created a Git branch locally; I clarified that I created it on the GitHub website, which prompted the AI to correctly suggest running `git fetch` first.