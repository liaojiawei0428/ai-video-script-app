import RNFS from 'react-native-fs';

const TOKEN_FILE = RNFS.DocumentDirectoryPath + '/.auth_token';

export async function saveToken(token: string): Promise<void> {
  try {
    await RNFS.writeFile(TOKEN_FILE, token, 'utf8');
  } catch {}
}

export async function getToken(): Promise<string | null> {
  try {
    const exists = await RNFS.exists(TOKEN_FILE);
    if (!exists) return null;
    const content = await RNFS.readFile(TOKEN_FILE, 'utf8');
    return content?.trim() || null;
  } catch {
    return null;
  }
}

export async function deleteToken(): Promise<void> {
  try {
    const exists = await RNFS.exists(TOKEN_FILE);
    if (exists) await RNFS.unlink(TOKEN_FILE);
  } catch {}
}
