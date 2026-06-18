export type CsRoleCategory = {
  id: string;
  label: string;
  description: string;
  roles: string[];
};

export const CS_ROLE_LABELS: Record<string, string> = {
  READ_DRIVER_PROFILE: "Read driver profiles",
  READ_CUSTOMER_PROFILE: "Read customer profiles",
  UPDATE_DRIVER_STATUS: "Update driver status",
  UPDATE_CUSTOMER_STATUS: "Update customer status",
  VERIFY_ACCOUNTS: "Verify accounts",
  ACCEPT_LOCAL_PAYMENT: "Accept local payment",
  VIEW_DELIVERIES: "View deliveries",
  SEE_DELIVERY_COMPANY: "See delivery companies",
  MANAGE_DELIVERY_COMPANY: "Manage delivery companies",
  MANAGE_DISPUTES: "Manage disputes",
  MANAGE_SUPPORT_TICKETS: "Manage support tickets",
  VIEW_FINANCIAL_REPORTS: "View financial reports",
  MANAGE_FINANCIAL_REPORTS: "Manage financial reports",
  PROCESS_WITHDRAWALS: "Process withdrawals",
  MANAGE_COMPANY_FINANCE: "Manage company finance",
};

export const CS_ROLE_CATEGORIES: CsRoleCategory[] = [
  {
    id: "profiles",
    label: "User profiles",
    description: "View and manage customer & driver accounts",
    roles: [
      "READ_DRIVER_PROFILE",
      "READ_CUSTOMER_PROFILE",
      "UPDATE_DRIVER_STATUS",
      "UPDATE_CUSTOMER_STATUS",
      "VERIFY_ACCOUNTS",
    ],
  },
  {
    id: "deliveries",
    label: "Deliveries & payments",
    description: "Orders, deliveries, and in-person payments",
    roles: ["VIEW_DELIVERIES", "ACCEPT_LOCAL_PAYMENT"],
  },
  {
    id: "companies",
    label: "Delivery companies",
    description: "Company visibility, management, and budgets",
    roles: ["SEE_DELIVERY_COMPANY", "MANAGE_DELIVERY_COMPANY", "MANAGE_COMPANY_FINANCE"],
  },
  {
    id: "support",
    label: "Support & disputes",
    description: "Tickets, complaints, and dispute resolution",
    roles: ["MANAGE_DISPUTES", "MANAGE_SUPPORT_TICKETS"],
  },
  {
    id: "finance",
    label: "Finance & analytics",
    description: "Reports, withdrawals, and financial tools",
    roles: ["VIEW_FINANCIAL_REPORTS", "MANAGE_FINANCIAL_REPORTS", "PROCESS_WITHDRAWALS"],
  },
];

export const ALL_CS_ROLES = CS_ROLE_CATEGORIES.flatMap((c) => c.roles);

export function formatCsRole(role: string): string {
  return CS_ROLE_LABELS[role] ?? role.replace(/_/g, " ").toLowerCase();
}

export function getCsRoleCategory(role: string): CsRoleCategory | undefined {
  return CS_ROLE_CATEGORIES.find((c) => c.roles.includes(role));
}
