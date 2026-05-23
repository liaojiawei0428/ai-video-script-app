declare module 'react-native-sqlite-storage' {
  export interface SQLiteDatabase {
    executeSql(sql: string, params?: any[]): Promise<[ResultSet]>;
    close(): Promise<void>;
  }

  export interface ResultSet {
    rows: {
      length: number;
      item(index: number): any;
    };
    rowsAffected: number;
    insertId?: number;
  }

  export function enablePromise(enable: boolean): void;
  export function openDatabase(config: {
    name: string;
    location?: string;
    key?: string;
  }): Promise<SQLiteDatabase>;

  const SQLite: {
    enablePromise(enable: boolean): void;
    openDatabase(config: {
      name: string;
      location?: string;
      key?: string;
    }): Promise<SQLiteDatabase>;
  };

  export default SQLite;
}


