# How to get me the SharePoint material

The goal is not "Claude connects to SharePoint." The goal is **files sitting in
`protocol/_source/`**. Once they are there I read them with the same tools I read every
other file in this workspace. Any route that ends with files in that folder works.

---

## Route A: zip it. Works today, ten minutes, no IT involved.

Best first move. Do this even if you also set up Route B, because it unblocks me now.

**Cavo does:**
1. Open the SharePoint folder in a browser
2. Select the files (or the whole folder)
3. **Download**. SharePoint zips it
4. Email or Drive it to Tyler

**Tyler does:**
5. Unzip into `02_clients/pounds_transformation/protocol/_source/`
6. Tell me. I read it and start building.

| Pro | Con |
|---|---|
| Works immediately, no permissions, no admin | Snapshot. When Cavo edits the doc, mine is stale until he resends |

---

## Route B: synced folder. Best long term, needs Cavo's IT.

The folder lives on this machine and updates itself when Pounds edits it.

**The honest catch:** OneDrive sync usually does **not** work for external guests. Most
tenants block it. There are two versions of this and only one reliably works.

### B1. Tyler gets a real account in their tenant (this one works)

Cavo's IT creates `tyler@poundstransformation.com`, a Microsoft 365 Business Basic seat,
about $6/month. Then:

1. Tyler signs into the OneDrive app with that account
2. Open the SharePoint library in a browser
3. Click **Sync** (or **Add shortcut to My files**)
4. The folder appears under OneDrive on this machine
5. Point `_source/` at it (see below)

Costs a seat. Works properly. Also gives Tyler a real address at their domain, which is
worth having anyway.

### B2. Guest share (try it, but expect it to fail)

Cavo shares the folder to `tylercavo@gmail.com` from the library's **Share** button. Tyler
may be able to use **Add shortcut to My files**. Sync often refuses for guests.

Try B2 first since it is free. If sync will not attach, fall back to A or pay for B1.

### Pointing `_source/` at the synced folder

Once the folder exists on disk, run this once in an **admin** terminal so `_source/` reads
the live folder instead of a copy:

```
rmdir "C:\Users\TCSca\OneDrive\Desktop\tcscales\02_clients\pounds_transformation\protocol\_source"
mklink /D "C:\Users\TCSca\OneDrive\Desktop\tcscales\02_clients\pounds_transformation\protocol\_source" "<path to the synced folder>"
```

---

## Route C: a claude.ai SharePoint connector

Skip it. It would still need a Microsoft identity with rights inside Cavo's tenant, which
is exactly the B1 problem, and it adds a dependency for no gain over a synced folder.

---

## Two rules that apply to every route

**1. One folder, clinical education material only.** Not the whole site. A medical
practice's SharePoint holds patient documents, and none of that belongs on the agency side.
If a file has a patient name in it, it does not come across. Say this to Cavo explicitly so
he scopes what he shares.

**2. Check the size before syncing.** This machine already syncs about 163,000 files
through OneDrive and the laptop has a known hardware fault. A large library makes that
worse. One folder, not the site.

---

## What to send Cavo

> For the protocol material, easiest thing is to open the SharePoint folder, select the
> files, hit Download, and send me the zip. Takes two minutes and I can start today.
>
> If you would rather I work off the live folder so it stays current, have IT either share
> that one folder to me externally or set me up with an account on your domain. Either
> works, the account is more reliable.
>
> Either way: just the clinical education material, one folder. Nothing with a patient name
> on it. I do not want patient records on my side of this.
