import { db } from "./index";
import {
  customerSubscriptions,
  organizationMembers,
  organizations,
  projects,
  subscriptionPlans,
  users,
} from "./schema";

async function seed() {
  console.log("🌱 Starting database seed...\n");

  // Clear existing data (in reverse order of dependencies)
  console.log("🗑️  Clearing existing data...");
  await db.delete(customerSubscriptions);
  await db.delete(projects);
  await db.delete(organizationMembers);
  await db.delete(organizations);
  await db.delete(subscriptionPlans);
  await db.delete(users);

  // ============================================
  // 1. Create Subscription Plans
  // ============================================
  console.log("📦 Creating subscription plans...");

  const createdPlans = await db
    .insert(subscriptionPlans)
    .values([
      {
        name: "free",
        displayName: "Free",
        description: "Perfect for getting started",
        priceMonthlyUsd: 0,
        priceYearlyUsd: 0,
        maxProjects: 3,
        maxUsers: 1,
        maxStorageGb: 1,
        maxAiCreditsMonthly: 100,
        aiFeaturesEnabled: ["chat"],
        features: {
          api_access: true,
          email_support: false,
          priority_support: false,
          custom_domain: false,
          analytics: false,
        },
        isActive: true,
        sortOrder: 1,
      },
      {
        name: "pro",
        displayName: "Pro",
        description: "For professionals and small teams",
        priceMonthlyUsd: 1900, // $19.00
        priceYearlyUsd: 19000, // $190.00 (2 months free)
        maxProjects: 10,
        maxUsers: 5,
        maxStorageGb: 10,
        maxAiCreditsMonthly: 1000,
        aiFeaturesEnabled: ["chat", "code_completion", "image_generation"],
        features: {
          api_access: true,
          email_support: true,
          priority_support: false,
          custom_domain: true,
          analytics: true,
        },
        isActive: true,
        sortOrder: 2,
      },
      {
        name: "business",
        displayName: "Business",
        description: "For growing businesses",
        priceMonthlyUsd: 4900, // $49.00
        priceYearlyUsd: 49000, // $490.00 (2 months free)
        maxProjects: 50,
        maxUsers: 20,
        maxStorageGb: 100,
        maxAiCreditsMonthly: 10000,
        aiFeaturesEnabled: ["chat", "code_completion", "image_generation", "voice", "video"],
        features: {
          api_access: true,
          email_support: true,
          priority_support: true,
          custom_domain: true,
          analytics: true,
          sso: true,
          audit_logs: true,
        },
        isActive: true,
        sortOrder: 3,
      },
    ])
    .returning();

  const proPlan = createdPlans.find((p) => p.name === "pro");
  const businessPlan = createdPlans.find((p) => p.name === "business");

  if (!proPlan || !businessPlan) {
    throw new Error("Failed to create subscription plans");
  }

  console.log(`   ✅ Created ${createdPlans.length} subscription plans`);

  // ============================================
  // 2. Create Users
  // ============================================
  console.log("👤 Creating users...");

  // Hash for "password123" - in real app use proper hashing
  const demoPasswordHash = await Bun.password.hash("password123", {
    algorithm: "bcrypt",
    cost: 10,
  });

  const createdUsers = await db
    .insert(users)
    .values([
      {
        email: "admin@example.com",
        hashedPassword: demoPasswordHash,
        name: "Admin User",
        role: "admin",
        status: "active",
        isActive: true,
        isSuperuser: true,
        isVerified: true,
        onboardingCompleted: true,
        onboardingStep: 5,
        timezone: "America/New_York",
        company: "Acme Corp",
        jobTitle: "System Administrator",
      },
      {
        email: "demo@example.com",
        hashedPassword: demoPasswordHash,
        name: "Demo User",
        role: "member",
        status: "active",
        isActive: true,
        isSuperuser: false,
        isVerified: true,
        onboardingCompleted: true,
        onboardingStep: 5,
        timezone: "America/Los_Angeles",
        company: "Demo Inc",
        jobTitle: "Developer",
      },
      {
        email: "member@example.com",
        hashedPassword: demoPasswordHash,
        name: "Team Member",
        role: "member",
        status: "active",
        isActive: true,
        isSuperuser: false,
        isVerified: true,
        onboardingCompleted: true,
        onboardingStep: 5,
        timezone: "Europe/London",
      },
    ])
    .returning();

  const adminUser = createdUsers.find((u) => u.email === "admin@example.com");
  const demoUser = createdUsers.find((u) => u.email === "demo@example.com");
  const memberUser = createdUsers.find((u) => u.email === "member@example.com");

  if (!adminUser || !demoUser || !memberUser) {
    throw new Error("Failed to create users");
  }

  console.log(`   ✅ Created ${createdUsers.length} users`);

  // ============================================
  // 3. Create Organizations
  // ============================================
  console.log("🏢 Creating organizations...");

  const createdOrgs = await db
    .insert(organizations)
    .values([
      {
        name: "Acme Corporation",
        slug: "acme-corp",
        description: "Leading technology solutions provider",
        planName: "business",
        maxProjects: 50,
        activeProjects: 2,
      },
      {
        name: "Demo Organization",
        slug: "demo-org",
        description: "A demo organization for testing",
        planName: "pro",
        maxProjects: 10,
        activeProjects: 1,
      },
    ])
    .returning();

  const acmeOrg = createdOrgs.find((o) => o.slug === "acme-corp");
  const demoOrg = createdOrgs.find((o) => o.slug === "demo-org");

  if (!acmeOrg || !demoOrg) {
    throw new Error("Failed to create organizations");
  }

  console.log(`   ✅ Created ${createdOrgs.length} organizations`);

  // ============================================
  // 4. Create Organization Members
  // ============================================
  console.log("👥 Adding organization members...");

  await db.insert(organizationMembers).values([
    // Acme Corp members
    { userId: adminUser.id, organizationId: acmeOrg.id, role: "owner" },
    { userId: demoUser.id, organizationId: acmeOrg.id, role: "admin" },
    { userId: memberUser.id, organizationId: acmeOrg.id, role: "member" },
    // Demo Org members
    { userId: demoUser.id, organizationId: demoOrg.id, role: "owner" },
    { userId: memberUser.id, organizationId: demoOrg.id, role: "viewer" },
  ]);

  console.log(`   ✅ Added ${5} organization memberships`);

  // ============================================
  // 5. Create Projects
  // ============================================
  console.log("📁 Creating projects...");

  await db.insert(projects).values([
    // Acme Corp projects
    {
      name: "Website Redesign",
      description: "Complete overhaul of the corporate website",
      organizationId: acmeOrg.id,
    },
    {
      name: "Mobile App v2",
      description: "Next generation mobile application",
      organizationId: acmeOrg.id,
    },
    {
      name: "Internal Tools",
      description: "Internal productivity tools",
      organizationId: acmeOrg.id,
    },
    // Demo Org projects
    {
      name: "Demo Project",
      description: "A sample project for demonstration",
      organizationId: demoOrg.id,
    },
  ]);

  console.log(`   ✅ Created ${4} projects`);

  // ============================================
  // 6. Create Subscriptions
  // ============================================
  console.log("💳 Creating subscriptions...");

  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  await db.insert(customerSubscriptions).values([
    {
      organizationId: acmeOrg.id,
      planId: businessPlan.id,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth,
      currentUsersCount: 3,
      currentProjectsCount: 2,
    },
    {
      organizationId: demoOrg.id,
      planId: proPlan.id,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth,
      currentUsersCount: 2,
      currentProjectsCount: 1,
    },
  ]);

  console.log(`   ✅ Created ${2} subscriptions`);

  // ============================================
  // Summary
  // ============================================
  console.log(`\n${"=".repeat(50)}`);
  console.log("🎉 Seed completed successfully!\n");
  console.log("📋 Test Accounts:");
  console.log("   ┌─────────────────────────────────────────┐");
  console.log("   │ Email              │ Password           │");
  console.log("   ├─────────────────────────────────────────┤");
  console.log("   │ admin@example.com  │ password123        │");
  console.log("   │ demo@example.com   │ password123        │");
  console.log("   │ member@example.com │ password123        │");
  console.log("   └─────────────────────────────────────────┘");
  console.log(`\n${"=".repeat(50)}`);

  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
