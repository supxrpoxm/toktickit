import { getPrisma } from "../src/prisma.js";

async function main() {
  const prisma = getPrisma();

  // --- Categories ---
  const categoryNames = [
    "Account and Access",
    "Hardware",
    "Software",
    "Network",
  ];

  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // --- Related Systems ---
  const relatedSystemNames = [
    "HR Portal",
    "Identity Provider",
    "VPN",
    "Finance System",
    "Asset Management",
    "Email Platform",
  ];

  for (const name of relatedSystemNames) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // --- Requesters ---
  const requesterSeeds = [
    { name: "Alice Johnson", email: "alice@company.com", isActive: true },
    { name: "Brandon Lee", email: "brandon@company.com", isActive: true },
    { name: "Carmen Diaz", email: "carmen@company.com", isActive: true },
    { name: "Darius Patel", email: "darius@company.com", isActive: true },
    { name: "Evelyn Gray", email: "evelyn@company.com", isActive: false },
  ];

  for (const requester of requesterSeeds) {
    await prisma.requester.upsert({
      where: { email: requester.email },
      update: {
        name: requester.name,
        isActive: requester.isActive,
      },
      create: {
        name: requester.name,
        email: requester.email,
        isActive: requester.isActive,
      },
    });
  }

  // --- 50 Mock Tickets ---
  const categories = await prisma.category.findMany({ orderBy: { id: "asc" } });
  const systems = await prisma.relatedSystem.findMany({ orderBy: { id: "asc" } });
  const activeRequesters = requesterSeeds.filter((r) => r.isActive);

  const priorities = ["High", "Medium", "Low"] as const;
  const statuses = ["Open", "In Progress", "Resolved", "Closed"];

  const ticketTemplates = [
    { title: "Cannot login to VPN", description: "I am unable to connect to the company VPN since this morning. I have tried restarting my computer and reinstalling the VPN client but the issue persists.", category: "Network", system: "VPN" },
    { title: "Request new laptop", description: "My current laptop is over 5 years old and running very slowly. I need a replacement to continue my daily work efficiently.", category: "Hardware", system: "Asset Management" },
    { title: "Reset email password", description: "I forgot my email password and cannot access my inbox. I have important meetings scheduled and need access restored urgently.", category: "Account and Access", system: "Email Platform" },
    { title: "Install Photoshop license", description: "I need Adobe Photoshop installed on my workstation for the upcoming marketing campaign. Please install the licensed version.", category: "Software", system: null },
    { title: "WiFi keeps disconnecting in Building B", description: "The WiFi connection in Building B, floor 3, keeps dropping every few minutes. Multiple colleagues are experiencing the same issue.", category: "Network", system: null },
    { title: "Request access to HR Portal", description: "I need read access to the HR Portal to review team attendance reports. My manager has approved this request.", category: "Account and Access", system: "HR Portal" },
    { title: "Replace broken monitor", description: "My monitor has horizontal lines across the screen and is barely readable. I need a replacement as soon as possible.", category: "Hardware", system: "Asset Management" },
    { title: "Update Visual Studio Code", description: "My VS Code is on version 1.74 and I need the latest version to use the new debugging features required for my project.", category: "Software", system: null },
    { title: "Cannot access Finance System", description: "I am getting a 403 Forbidden error when trying to access the Finance System. I recently changed departments and may need updated permissions.", category: "Account and Access", system: "Finance System" },
    { title: "Printer on 4th floor not working", description: "The shared printer on the 4th floor has a paper jam that I cannot clear. It has been down since yesterday.", category: "Hardware", system: "Asset Management" },
    { title: "Request GitLab repository access", description: "I need access to the backend-api repository on GitLab to contribute to the current sprint. My team lead is John Smith.", category: "Account and Access", system: null },
    { title: "Slow database queries in production", description: "Several queries in the production database are timing out. Average response time has increased from 200ms to over 5 seconds.", category: "Software", system: "Finance System" },
    { title: "Set up new employee workstation", description: "A new employee is joining the team next Monday. Please prepare a laptop with standard dev tools and domain access.", category: "Hardware", system: "Identity Provider" },
    { title: "Cannot send emails larger than 10MB", description: "When I try to send emails with attachments larger than 10MB, the email bounces back. I need to send large files to clients regularly.", category: "Software", system: "Email Platform" },
    { title: "Request overtime access to VPN", description: "I need extended VPN access hours for the project deadline next week. Standard hours are not sufficient.", category: "Network", system: "VPN" },
    { title: "Broken keyboard key", description: "The 'Enter' key on my keyboard is stuck and sometimes does not register. I need a replacement keyboard.", category: "Hardware", system: "Asset Management" },
    { title: "Flickering lights in meeting room 3", description: "The fluorescent lights in meeting room 3 are flickering constantly. It is causing headaches during long meetings.", category: "Hardware", system: null },
    { title: "Request additional monitor", description: "I need a second monitor for my development work. Having dual screens will significantly improve my productivity.", category: "Hardware", system: "Asset Management" },
    { title: "SQL Server running out of disk space", description: "The SQL Server for the analytics database is at 95% disk usage. We need to either expand the disk or archive old data.", category: "Software", system: "Finance System" },
    { title: "Cannot access Identity Provider portal", description: "I am unable to log into the Identity Provider portal to manage my security settings. The page shows a connection timeout.", category: "Account and Access", system: "Identity Provider" },
    { title: "New laptop for remote work", description: "I have been approved for remote work and need a company laptop with VPN pre-configured. Please set up and deliver to my desk.", category: "Hardware", system: "VPN" },
    { title: "Install Node.js LTS version", description: "I need Node.js LTS (v20) installed on my development machine. The current version is outdated and causing compatibility issues.", category: "Software", system: null },
    { title: "Network switch failure in server room", description: "Network switch port 12 in the server room is showing amber light. Several servers are unreachable. This is urgent.", category: "Network", system: null },
    { title: "Request access to Asset Management system", description: "I need write access to the Asset Management system to update inventory records for the newly arrived equipment.", category: "Account and Access", system: "Asset Management" },
    { title: "Laptop battery drains in 30 minutes", description: "My laptop battery only lasts about 30 minutes on a full charge. It used to last over 4 hours. I suspect the battery needs replacement.", category: "Hardware", system: "Asset Management" },
    { title: "Deploy staging environment", description: "We need a new staging environment set up for the Q4 release testing. Please configure it to match production settings.", category: "Software", system: null },
    { title: "Cannot access HR Portal leave module", description: "I can log into the HR Portal but the Leave Management module shows 'Access Denied'. I need this to submit my vacation request.", category: "Account and Access", system: "HR Portal" },
    { title: "Ethernet cable damaged in office", description: "The Ethernet cable under my desk appears to be damaged. My wired connection keeps dropping. I need a replacement cable.", category: "Network", system: null },
    { title: "Request Outlook add-in installation", description: "I need the CRM Outlook add-in installed to track client communications directly from my email. My manager has approved.", category: "Software", system: "Email Platform" },
    { title: "Server room temperature alert", description: "The temperature monitoring system is showing 32°C in the server room. The normal range is 18-24°C. Please check the cooling system.", category: "Hardware", system: null },
    { title: "Reset two-factor authentication", description: "I lost my phone and cannot complete two-factor authentication. I need to reset my 2FA settings to regain access to company systems.", category: "Account and Access", system: "Identity Provider" },
    { title: "VPN disconnects during video calls", description: "When I join video conferences through Teams while connected to VPN, the VPN drops after about 10 minutes. This happens consistently.", category: "Network", system: "VPN" },
    { title: "Request Docker Desktop installation", description: "I need Docker Desktop installed on my workstation for containerized development. This is required for the microservices project.", category: "Software", system: null },
    { title: "USB ports not working on workstation", description: "None of the USB ports on my desktop are working. I cannot use my mouse, keyboard, or flash drives. This is blocking all work.", category: "Hardware", system: "Asset Management" },
    { title: "Cannot create Jira tickets", description: "When I try to create a new Jira ticket, I get a permission error. I can view existing tickets but cannot create or edit them.", category: "Account and Access", system: null },
    { title: "DNS resolution failure for internal sites", description: "Internal sites like wiki.company.com and git.company.com are not resolving. External sites work fine. This affects the entire floor.", category: "Network", system: null },
    { title: "License expired for IntelliJ IDEA", description: "My IntelliJ IDEA license expired today and I cannot use the IDE. I need a renewal or a new license key as soon as possible.", category: "Software", system: null },
    { title: "Request desk relocation", description: "I need to relocate to the 3rd floor to be closer to my team. Please arrange a desk move for next week.", category: "Hardware", system: null },
    { title: "Email forwarding not working", description: "I set up email forwarding to my personal account but it is not working. Emails are not being forwarded as configured.", category: "Software", system: "Email Platform" },
    { title: "Firewall blocking development tools", description: "The corporate firewall is blocking access to npm registry and GitHub. I cannot install packages or push code. Please whitelist these domains.", category: "Network", system: null },
    { title: "Black screen on login", description: "When I log into my Windows workstation, the screen stays black for about 3 minutes before the desktop appears. This started after the last update.", category: "Hardware", system: null },
    { title: "Cannot access VPN from home network", description: "I am unable to connect to VPN from my home network. The connection times out. It works fine from the office. My ISP might be blocking the ports.", category: "Network", system: "VPN" },
    { title: "Need admin rights for software install", description: "I need temporary admin rights to install a critical security patch on my machine. The standard user account does not allow this.", category: "Account and Access", system: "Identity Provider" },
    { title: "Report server performance degradation", description: "The reporting server has been extremely slow for the past week. Reports that used to take 30 seconds now take over 5 minutes to generate.", category: "Software", system: "Finance System" },
    { title: "Air conditioner not working in office", description: "The AC in our office area (Room 405) has been off since this morning. It is getting very warm and uncomfortable.", category: "Hardware", system: null },
    { title: "Request database backup restoration", description: "I accidentally deleted some records in the production database. I need a restoration from the backup taken 2 hours ago. This is urgent.", category: "Software", system: "Finance System" },
    { title: "Cannot connect to shared drive", description: "I cannot access the shared network drive (\\\\fileserver\\shared). I get an 'Access Denied' error. Other colleagues can access it fine.", category: "Network", system: null },
    { title: "Request new mouse and mousepad", description: "My mouse double-clicks when I single-click and the mousepad is worn out. I need both replaced.", category: "Hardware", system: "Asset Management" },
  ];

  // Clear existing tickets first
  await prisma.attachment.deleteMany();
  await prisma.ticket.deleteMany();

  const categoryMap: Record<string, number> = {};
  for (const cat of categories) {
    categoryMap[cat.name] = cat.id;
  }

  const systemMap: Record<string, number> = {};
  for (const sys of systems) {
    systemMap[sys.name] = sys.id;
  }

  const requesterIds = [1, 2, 3, 4]; // active requesters

  let ticketCount = 0;

  for (let i = 0; i < ticketTemplates.length; i++) {
    const template = ticketTemplates[i];
    const requesterId = requesterIds[i % requesterIds.length];
    const categoryId = categoryMap[template.category];
    const relatedSystemId = template.system ? systemMap[template.system] ?? null : null;
    const priority = priorities[i % 3]; // rotate High, Medium, Low
    const status = statuses[i % 4]; // rotate Open, In Progress, Resolved, Closed

    const daysAgo = Math.floor(Math.random() * 60);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(Math.floor(Math.random() * 12) + 8);
    createdAt.setMinutes(Math.floor(Math.random() * 60));

    await prisma.ticket.create({
      data: {
        title: template.title,
        description: template.description,
        priority,
        status,
        requesterId,
        categoryId,
        relatedSystemId,
        createdAt,
        updatedAt: createdAt,
      },
    });

    ticketCount++;
  }

  console.log(
    `Seeded ${categoryNames.length} categories, ${relatedSystemNames.length} related systems, ${requesterSeeds.length} requesters, and ${ticketCount} tickets.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
