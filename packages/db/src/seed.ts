import { getDB } from './index.js';
import {
  tenants, tenantSettings, users, roles, permissions,
  rolePermissions, userRoles,
} from './schema/index.js';
import { eq, and, sql } from 'drizzle-orm';

// ─── Password Hashing (PBKDF2 — same as gateway/auth) ─────

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100_000, hash: 'SHA-256' },
    keyMaterial, 256,
  );
  const hash = Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${salt}:${hash}`;
}

// ─── Permission & Role constants ───────────────────────────

const RESOURCES = [
  'chat', 'sessions', 'knowledge', 'workflows', 'integrations',
  'domains', 'settings', 'users', 'roles', 'tenants', 'models',
  'ml', 'agents', 'webhooks', 'mcp',
] as const;
const ACTIONS = ['read', 'write', 'delete', 'manage'] as const;

const ALL_PERMISSIONS: Array<{ resource: string; action: string }> = [];
for (const resource of RESOURCES) {
  for (const action of ACTIONS) {
    ALL_PERMISSIONS.push({ resource, action });
  }
}

const DEFAULT_ROLES = [
  { name: 'owner', displayName: 'Owner', description: 'Full access to everything.', permissions: ['*:*'] },
  {
    name: 'admin', displayName: 'Admin', description: 'Full access except tenant deletion.',
    permissions: [
      'chat:read', 'chat:write', 'chat:delete', 'chat:manage',
      'sessions:read', 'sessions:write', 'sessions:delete', 'sessions:manage',
      'knowledge:read', 'knowledge:write', 'knowledge:delete', 'knowledge:manage',
      'workflows:read', 'workflows:write', 'workflows:delete', 'workflows:manage',
      'integrations:read', 'integrations:write', 'integrations:delete', 'integrations:manage',
      'domains:read', 'domains:write', 'domains:delete', 'domains:manage',
      'settings:read', 'settings:write', 'settings:manage',
      'users:read', 'users:write', 'users:delete', 'users:manage',
      'roles:read', 'roles:write', 'roles:delete', 'roles:manage',
      'models:read', 'models:write', 'models:manage',
      'ml:read', 'ml:write', 'ml:manage',
      'agents:read', 'agents:write', 'agents:delete', 'agents:manage',
      'webhooks:read', 'webhooks:write', 'webhooks:delete', 'webhooks:manage',
      'mcp:read', 'mcp:write', 'mcp:manage',
    ],
  },
  {
    name: 'member', displayName: 'Member', description: 'Standard access.',
    permissions: [
      'chat:read', 'chat:write', 'sessions:read', 'sessions:write',
      'knowledge:read', 'workflows:read', 'workflows:write',
      'integrations:read', 'integrations:write', 'domains:read',
      'models:read', 'ml:read', 'agents:read', 'mcp:read',
    ],
  },
  {
    name: 'viewer', displayName: 'Viewer', description: 'Read-only access.',
    permissions: [
      'chat:read', 'sessions:read', 'knowledge:read', 'workflows:read',
      'integrations:read', 'domains:read', 'models:read', 'agents:read',
    ],
  },
];

// ─── Default seed values ───────────────────────────────────

const DEFAULT_TENANT_ID = 'default';
const DEFAULT_TENANT = {
  id: DEFAULT_TENANT_ID,
  name: 'xClaw',
  slug: 'xclaw',
  plan: 'pro' as const,
  status: 'active' as const,
};

const DEFAULT_ADMIN = {
  name: 'Admin',
  email: 'admin@xclaw.io',
  password: 'password123',
  role: 'owner' as const,
};

// ─── Seed Function ─────────────────────────────────────────

export async function seedInitialData() {
  const db = getDB();
  const now = new Date();

  // 1. Check if default tenant exists — if yes, skip seeding
  const [existingTenant] = await db.select({ id: tenants.id })
    .from(tenants).where(eq(tenants.id, DEFAULT_TENANT_ID)).limit(1);

  if (existingTenant) {
    return false; // already seeded
  }

  console.log('🌱 Seeding initial data...');

  // 2. Create default tenant
  await db.insert(tenants).values({
    ...DEFAULT_TENANT,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });
  console.log(`   ✓ Tenant: "${DEFAULT_TENANT.name}" (${DEFAULT_TENANT.slug})`);

  // 3. Create tenant settings
  await db.insert(tenantSettings).values({
    id: crypto.randomUUID(),
    tenantId: DEFAULT_TENANT_ID,
    createdAt: now,
    updatedAt: now,
  });
  console.log('   ✓ Tenant settings (defaults)');

  // 4. Seed global permissions
  for (const perm of ALL_PERMISSIONS) {
    const id = `${perm.resource}:${perm.action}`;
    const [existing] = await db.select().from(permissions)
      .where(and(eq(permissions.resource, perm.resource), eq(permissions.action, perm.action)))
      .limit(1);
    if (!existing) {
      await db.insert(permissions).values({
        id,
        resource: perm.resource,
        action: perm.action,
        description: `${perm.action} access to ${perm.resource}`,
      });
    }
  }
  console.log(`   ✓ Permissions: ${ALL_PERMISSIONS.length} entries`);

  // 5. Seed default roles for tenant
  const allPerms = await db.select().from(permissions);
  const permMap = new Map(allPerms.map(p => [`${p.resource}:${p.action}`, p.id]));

  for (const tpl of DEFAULT_ROLES) {
    const roleId = `${DEFAULT_TENANT_ID}:${tpl.name}`;
    await db.insert(roles).values({
      id: roleId,
      tenantId: DEFAULT_TENANT_ID,
      name: tpl.name,
      displayName: tpl.displayName,
      description: tpl.description,
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    });

    // Assign permissions to role
    if (tpl.permissions.includes('*:*')) {
      for (const perm of allPerms) {
        await db.insert(rolePermissions).values({
          id: `${roleId}:${perm.id}`, roleId, permissionId: perm.id,
        });
      }
    } else {
      for (const permKey of tpl.permissions) {
        const permId = permMap.get(permKey);
        if (permId) {
          await db.insert(rolePermissions).values({
            id: `${roleId}:${permId}`, roleId, permissionId: permId,
          });
        }
      }
    }
  }
  console.log(`   ✓ Roles: ${DEFAULT_ROLES.map(r => r.name).join(', ')}`);

  // 6. Create admin user
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(DEFAULT_ADMIN.password);

  await db.insert(users).values({
    id: userId,
    tenantId: DEFAULT_TENANT_ID,
    name: DEFAULT_ADMIN.name,
    email: DEFAULT_ADMIN.email,
    passwordHash,
    role: DEFAULT_ADMIN.role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // 7. Assign owner role to admin user
  const ownerRoleId = `${DEFAULT_TENANT_ID}:owner`;
  await db.insert(userRoles).values({
    id: crypto.randomUUID(),
    userId,
    roleId: ownerRoleId,
    assignedAt: now,
  });

  console.log(`   ✓ Admin user: ${DEFAULT_ADMIN.email} / ${DEFAULT_ADMIN.password}`);
  console.log('🌱 Seed complete!\n');
  console.log('   📋 Login credentials:');
  console.log(`      Email:    ${DEFAULT_ADMIN.email}`);
  console.log(`      Password: ${DEFAULT_ADMIN.password}`);
  console.log(`      Tenant:   ${DEFAULT_TENANT.slug}\n`);

  return true;
}
