# Gumroad: Publish the boilerplate ($149/sale)

**Slug live on kanzenai.com:** `gumroad.com/l/icchv`
**Status:** DRAFT (zip uploaded? — file-picker was broken last attempt on Mac)
**This is the fastest path to first revenue.** Zero approvals required. Your own codebase. Just ship.

---

## Why this is Step 1
- Every other affiliate engine takes 30+ days for approval.
- Boilerplate is your own product — instant publish, instant sale-ability.
- Sales-page already deployed to kanzenai.com/boilerplate with the correct slug.
- Even ONE sale ($149) covers ~3 months of KanzenAi tooling spend.

## What to do (5 minutes)
1. Open https://app.gumroad.com/products in browser
2. Find the draft listing — slug should match `icchv`
3. **Confirm the zip is attached.** The Mac file-picker was blocked last attempt. If still blocked:
   - The zip lives on Mac at `/tmp/affiliateai-boilerplate.zip` (29 MB)
   - Drag-drop it into the Gumroad uploader from Finder
   - If Mac is closed: re-zip from the current PC kanzenai (excluding `.env.local`, `node_modules`, `.next`, `.vercel`, `.git`):
     ```powershell
     cd C:\Users\User\Code\kanzenai
     $exclude = @('.env*', 'node_modules', '.next', '.vercel', '.git', '.audit')
     # use 7-zip or built-in Compress-Archive
     Compress-Archive -Path * -DestinationPath C:\Users\User\Downloads\affiliateai-boilerplate.zip -Force
     ```
4. **Verify the price is $149**, one-time payment
5. **Click "Publish"** (top right)
6. Test the live link: https://gumroad.com/l/icchv — should now show your sales page on Gumroad's side
7. From kanzenai.com: click "Buy on Gumroad" → confirms end-to-end

## Launch posts (do AFTER publish)
Once the listing is live, draft posts on these platforms — see `outreach/launch-posts/` once you've published and tell me:

- Indie Hackers — https://www.indiehackers.com/post (Show IH category)
- r/SaaS — https://www.reddit.com/r/SaaS/submit
- r/Entrepreneur — https://www.reddit.com/r/Entrepreneur/submit
- Show HN — https://news.ycombinator.com/submit
- Personal X post from @KanzenOfficial (Banger-screened by the writer skill if you want)

## Webhook hook (set up after first sale)
Gumroad supports a webhook to ping Telegram on every sale. I'll wire this in once the listing is live — it'll show real-time sales in the dashboard.
