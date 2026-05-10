/**
 * Single source of truth for affiliate vendor URLs.
 *
 * Every affiliate link in articles + comparisons is now /go/<slug> — those
 * routes look up the real URL here and 302-redirect with a click log.
 *
 * When you get a real affiliate code back from a vendor, edit ONLY this
 * file. Article JSONs stay untouched.
 *
 * Slug rules:
 *   - lowercase, hyphenated
 *   - matches the vendor name closely
 *   - never reuse a slug for a different vendor (breaks click history)
 */

export type Vendor = {
  /** The real URL — replace ?ref=kanzenai with your real affiliate code when approved */
  url: string;
  /** Human-readable vendor name (used in click logs) */
  name: string;
  /** Status: "placeholder" until you have a real code; "live" once wired */
  status: "placeholder" | "live";
  /** Approximate commission, for reference (varies by vendor) */
  commission?: string;
};

export const AFFILIATES: Record<string, Vendor> = {
  // CRMs
  "follow-up-boss":      { url: "https://www.followupboss.com/?ref=kanzenai",      name: "Follow Up Boss",      status: "placeholder", commission: "$200/signup" },
  "lofty":               { url: "https://lofty.com/demo?ref=kanzenai",             name: "Lofty",               status: "placeholder", commission: "varies" },
  "kvcore":              { url: "https://www.insiderealestate.com/?ref=kanzenai",  name: "kvCORE",              status: "placeholder", commission: "$250/signup" },

  // IDX / Lead-gen
  "real-geeks":          { url: "https://www.realgeeks.com/?ref=kanzenai",         name: "Real Geeks",          status: "placeholder", commission: "$200/signup" },
  "sierra-interactive":  { url: "https://www.sierrainteractive.com/?ref=kanzenai", name: "Sierra Interactive",  status: "placeholder", commission: "$300/signup" },
  "placester":           { url: "https://placester.com/?ref=kanzenai",             name: "Placester",           status: "placeholder", commission: "$50/signup" },
  "idx-broker":          { url: "https://www.idxbroker.com/?ref=kanzenai",         name: "IDX Broker",          status: "placeholder", commission: "20% recurring" },

  // Dialers
  "mojo":                { url: "https://www.mojosells.com/?ref=kanzenai",         name: "Mojo Selling Solutions", status: "placeholder", commission: "$50/signup" },
  "vulcan7":             { url: "https://www.vulcan7.com/?ref=kanzenai",           name: "Vulcan7",             status: "placeholder", commission: "$75/signup" },
  "redx":                { url: "https://www.theredx.com/?ref=kanzenai",           name: "RedX",                status: "placeholder", commission: "$50/signup" },
  "phoneburner":         { url: "https://www.phoneburner.com/?ref=kanzenai",       name: "PhoneBurner",         status: "placeholder", commission: "25% recurring" },
  "espresso-agent":      { url: "https://www.espressoagent.com/?ref=kanzenai",     name: "Espresso Agent",      status: "placeholder", commission: "$60/signup" },

  // Transaction management
  "dotloop":             { url: "https://www.dotloop.com/?ref=kanzenai",           name: "Dotloop",             status: "placeholder", commission: "$30/signup" },
  "skyslope":            { url: "https://skyslope.com/?ref=kanzenai",              name: "SkySlope",            status: "placeholder", commission: "$200/signup" },
  "brokermint":          { url: "https://www.brokermint.com/?ref=kanzenai",        name: "Brokermint",          status: "placeholder", commission: "$100/signup" },
  "paperless-pipeline":  { url: "https://www.paperlesspipeline.com/?ref=kanzenai", name: "Paperless Pipeline",  status: "placeholder", commission: "$25/signup" },

  // AI / video / productivity
  "bombbomb":            { url: "https://bombbomb.com/?ref=kanzenai",              name: "BombBomb",            status: "placeholder", commission: "$30/signup" },
  "otter":               { url: "https://otter.ai/?ref=kanzenai",                  name: "Otter.ai",            status: "placeholder", commission: "$30/signup" },
  "spaceflow":           { url: "https://spaceflow.io/?ref=kanzenai",              name: "Spaceflow",           status: "placeholder", commission: "$50/signup" },
  "claude":              { url: "https://claude.com/?ref=kanzenai",                name: "Claude Pro",          status: "placeholder", commission: "$10/mo recurring" },
  "openai":              { url: "https://openai.com/chatgpt/?ref=kanzenai",        name: "ChatGPT Plus",        status: "placeholder", commission: "$8/mo recurring" },

  // Lead gen
  "zillow-premier-agent": { url: "https://www.zillow.com/premier-agent/?ref=kanzenai", name: "Zillow Premier Agent", status: "placeholder", commission: "varies" },

  // Email marketing
  "mailchimp":           { url: "https://mailchimp.com/?ref=kanzenai",             name: "Mailchimp",           status: "placeholder", commission: "varies" },
  "constant-contact":    { url: "https://www.constantcontact.com/?ref=kanzenai",   name: "Constant Contact",    status: "placeholder", commission: "varies" },
  "vyral-marketing":     { url: "https://getvyral.com/?ref=kanzenai",              name: "Vyral Marketing",     status: "placeholder", commission: "varies" },
  "activecampaign":      { url: "https://www.activecampaign.com/?ref=kanzenai",    name: "ActiveCampaign",      status: "placeholder", commission: "30% recurring" },

  // Bookkeeping
  "quickbooks":          { url: "https://quickbooks.intuit.com/?ref=kanzenai",     name: "QuickBooks",          status: "placeholder", commission: "varies" },
  "agentpay":            { url: "https://agentpay.com/?ref=kanzenai",              name: "AgentPay",            status: "placeholder", commission: "varies" },
  "bench":               { url: "https://bench.co/?ref=kanzenai",                  name: "Bench",               status: "placeholder", commission: "$100/signup" },
  "xero":                { url: "https://www.xero.com/?ref=kanzenai",              name: "Xero",                status: "placeholder", commission: "varies" },

  // Showing / scheduling
  "showingtime":         { url: "https://www.showingtime.com/?ref=kanzenai",       name: "ShowingTime",         status: "placeholder", commission: "varies" },
  "aligned-showings":    { url: "https://alignedshowings.com/?ref=kanzenai",       name: "Aligned Showings",    status: "placeholder", commission: "varies" },
  "sentrilock":          { url: "https://sentrilock.com/?ref=kanzenai",            name: "SentriLock",          status: "placeholder", commission: "varies" },
  "supra-ekey":          { url: "https://www.suprakey.com/?ref=kanzenai",          name: "SUPRA eKey",          status: "placeholder", commission: "varies" },
  "showmojo":            { url: "https://www.showmojo.com/?ref=kanzenai",          name: "ShowMojo",            status: "placeholder", commission: "varies" },
  "calendly":            { url: "https://calendly.com/?ref=kanzenai",              name: "Calendly",            status: "placeholder", commission: "varies" },
  "acuity-scheduling":   { url: "https://acuityscheduling.com/?ref=kanzenai",      name: "Acuity Scheduling",   status: "placeholder", commission: "varies" },
  "calendar-com":        { url: "https://calendar.com/?ref=kanzenai",              name: "Calendar.com",        status: "placeholder", commission: "varies" },
  "savvycal":            { url: "https://savvycal.com/?ref=kanzenai",              name: "SavvyCal",            status: "placeholder", commission: "varies" },
  "google-calendar":     { url: "https://calendar.google.com/",                    name: "Google Calendar",     status: "live", commission: "free product" },

  // Open house / sign-in
  "open-home-pro":       { url: "https://openhomepro.com/?ref=kanzenai",           name: "Open Home Pro",       status: "placeholder", commission: "varies" },
  "spacio":              { url: "https://spaciopro.com/?ref=kanzenai",             name: "Spacio",              status: "placeholder", commission: "varies" },
  "curb-hero":           { url: "https://curbhero.com/?ref=kanzenai",              name: "Curb Hero",           status: "placeholder", commission: "varies" },
  "block-party":         { url: "https://blockpartyapp.com/?ref=kanzenai",         name: "Block Party",         status: "placeholder", commission: "varies" },
  "signintime":          { url: "https://signintime.com/?ref=kanzenai",            name: "SignInTime",          status: "placeholder", commission: "varies" },

  // Photography / listings
  "aryeo":               { url: "https://www.aryeo.com/?ref=kanzenai",             name: "Aryeo",               status: "placeholder", commission: "varies" },
  "boxbrownie":          { url: "https://www.boxbrownie.com/?ref=kanzenai",        name: "BoxBrownie",          status: "placeholder", commission: "varies" },
  "vht-studios":         { url: "https://www.vht.com/?ref=kanzenai",               name: "VHT Studios",         status: "placeholder", commission: "varies" },
  "listing3d":           { url: "https://listing3d.com/?ref=kanzenai",             name: "Listing3D",           status: "placeholder", commission: "varies" },
  "listing-ai":          { url: "https://listing.ai/?ref=kanzenai",                name: "Listing AI",          status: "placeholder", commission: "varies" },
  "restb-ai":            { url: "https://restb.ai/?ref=kanzenai",                  name: "Restb.ai",            status: "placeholder", commission: "varies" },
  "writeraccess":        { url: "https://www.writeraccess.com/?ref=kanzenai",      name: "WriterAccess",        status: "placeholder", commission: "varies" },

  // AI lead qualifiers
  "structurely":         { url: "https://www.structurely.com/?ref=kanzenai",       name: "Structurely",         status: "placeholder", commission: "varies" },
  "lofty-ai-assistant":  { url: "https://lofty.com/ai?ref=kanzenai",               name: "Lofty AI Assistant",  status: "placeholder", commission: "varies" },
  "real-geeks-robin":    { url: "https://www.realgeeks.com/robin?ref=kanzenai",    name: "Real Geeks Robin AI", status: "placeholder", commission: "varies" },

  // ISA services
  "smith-ai":            { url: "https://smith.ai/?ref=kanzenai",                  name: "Smith.ai",            status: "placeholder", commission: "$100/signup" },
  "verse-io":            { url: "https://verse.io/?ref=kanzenai",                  name: "Verse.io",            status: "placeholder", commission: "varies" },
  "conversion-monster":  { url: "https://www.conversionmonster.com/?ref=kanzenai", name: "Conversion Monster",  status: "placeholder", commission: "varies" },
  "ylopo":               { url: "https://www.ylopo.com/?ref=kanzenai",             name: "Ylopo",               status: "placeholder", commission: "varies" },
  "agentology":          { url: "https://www.agentology.com/?ref=kanzenai",        name: "Agentology",          status: "placeholder", commission: "varies" },
};

/** Map a vendor name (e.g. "Follow Up Boss") to its slug (e.g. "follow-up-boss") */
export function vendorSlugFromName(name: string): string | null {
  const target = name.toLowerCase().trim();
  for (const [slug, v] of Object.entries(AFFILIATES)) {
    if (v.name.toLowerCase().trim() === target) return slug;
  }
  // Fallback: derive slug from name
  const derived = target.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return AFFILIATES[derived] ? derived : null;
}

/** Build the canonical /go/<slug> URL for a vendor */
export function goLink(slugOrName: string): string {
  const slug = AFFILIATES[slugOrName]
    ? slugOrName
    : vendorSlugFromName(slugOrName);
  return slug ? `/go/${slug}` : `/go/${slugOrName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
