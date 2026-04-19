import { query, execute } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface Project {
  id: string;
  name: string;
  code: string;
  is_active: number;
  created_at: string;
}

export const projectRepo = {
  getAll: (): Project[] => {
    return query<Project>('SELECT * FROM projects ORDER BY name ASC');
  },

  list: async (): Promise<Project[]> => {
    return query<Project>('SELECT * FROM projects ORDER BY name ASC');
  },

  listAll: (): Project[] => {
    return query<Project>('SELECT * FROM projects ORDER BY created_at DESC');
  },

  getById: (id: string): Project | null => {
    return query<Project>('SELECT * FROM projects WHERE id = ?', [id])[0] || null;
  },

  getActive: (): Project | null => {
    return query<Project>('SELECT * FROM projects WHERE is_active = 1')[0] || null;
  },

  create: async (project: { name: string; code: string }): Promise<string> => {
    const id = uuidv4();
    // If it's the first project, make it active
    const count = query<{c: number}>('SELECT COUNT(*) as c FROM projects')[0].c;
    const isActive = count === 0 ? 1 : 0;
    
    await execute(
      // Some legacy installs may have a NOT NULL created_at without a default; write it explicitly.
      'INSERT INTO projects (id, name, code, is_active, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [id, project.name, project.code, isActive]
    );
    return id;
  },

  setActive: async (id: string): Promise<void> => {
    await execute('UPDATE projects SET is_active = 0');
    await execute('UPDATE projects SET is_active = 1 WHERE id = ?', [id]);
  },

  update: async (id: string, project: { name: string; code: string }): Promise<void> => {
    await execute(
      'UPDATE projects SET name = ?, code = ? WHERE id = ?',
      [project.name, project.code, id]
    );
  },

  remove: async (id: string): Promise<void> => {
    await execute('DELETE FROM projects WHERE id = ?', [id]);
  }
};
