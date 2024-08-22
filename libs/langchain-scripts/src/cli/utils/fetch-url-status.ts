export const fetchURLStatus = async (url: string): Promise<boolean> => {
  try {
    const res = await fetch(url);
    if (res.status !== 200) {
      throw new Error(`API Reference URL ${url} not found.`);
    }
    return true;
  } catch (_) {
    return false;
  }
};
