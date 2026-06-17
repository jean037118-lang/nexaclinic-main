/**
 * storage.ts — NexaClinic Financial Storage
 *
 * Gerencia persistência de contas manuais e comissões.
 * Os agendamentos pagos vivem em 'nexaclinic_appointments_v3'
 * e são lidos via useFinancial (não armazenados aqui).
 */

import type { Account, MedicalCommission } from './types';

const STORAGE_KEYS = {
  ACCOUNTS:    'nexaclinic_accounts',
  COMMISSIONS: 'nexaclinic_commissions',
} as const;

export const financialStorage = {
  // ── Contas ──────────────────────────────────────────────────────────────────
  getAccounts(): Account[] {
    try {
      if (typeof window === 'undefined') return [];
      const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveAccount(account: Account): Account {
    try {
      if (typeof window === 'undefined') return account;
      const accounts = this.getAccounts();
      const idx = accounts.findIndex((a) => a.id === account.id);
      if (idx === -1) accounts.push(account);
      else accounts[idx] = account;
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
      return account;
    } catch (err) {
      console.error('Erro ao salvar conta:', err);
      throw err;
    }
  },

  saveAccounts(accounts: Account[]): Account[] {
    try {
      if (typeof window === 'undefined') return accounts;
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
      return accounts;
    } catch (err) {
      throw err;
    }
  },

  deleteAccount(accountId: string): void {
    try {
      if (typeof window === 'undefined') return;
      const filtered = this.getAccounts().filter((a) => a.id !== accountId);
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(filtered));
    } catch (err) {
      throw err;
    }
  },

  // ── Comissões ────────────────────────────────────────────────────────────────
  getCommissions(): MedicalCommission[] {
    try {
      if (typeof window === 'undefined') return [];
      const data = localStorage.getItem(STORAGE_KEYS.COMMISSIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveCommission(commission: MedicalCommission): MedicalCommission {
    try {
      if (typeof window === 'undefined') return commission;
      const all = this.getCommissions();
      const idx = all.findIndex((c) => c.id === commission.id);
      if (idx === -1) all.push(commission);
      else all[idx] = commission;
      localStorage.setItem(STORAGE_KEYS.COMMISSIONS, JSON.stringify(all));
      return commission;
    } catch (err) {
      throw err;
    }
  },

  saveCommissions(commissions: MedicalCommission[]): MedicalCommission[] {
    try {
      if (typeof window === 'undefined') return commissions;
      localStorage.setItem(STORAGE_KEYS.COMMISSIONS, JSON.stringify(commissions));
      return commissions;
    } catch (err) {
      throw err;
    }
  },

  deleteCommission(id: string): void {
    try {
      if (typeof window === 'undefined') return;
      const filtered = this.getCommissions().filter((c) => c.id !== id);
      localStorage.setItem(STORAGE_KEYS.COMMISSIONS, JSON.stringify(filtered));
    } catch (err) {
      throw err;
    }
  },

  clearAll(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.ACCOUNTS);
    localStorage.removeItem(STORAGE_KEYS.COMMISSIONS);
  },

  exportData() {
    return {
      accounts:    this.getAccounts(),
      commissions: this.getCommissions(),
      exportedAt:  new Date().toISOString(),
    };
  },

  importData(data: { accounts?: Account[]; commissions?: MedicalCommission[] }): void {
    if (data.accounts)    this.saveAccounts(data.accounts);
    if (data.commissions) this.saveCommissions(data.commissions);
  },
};
