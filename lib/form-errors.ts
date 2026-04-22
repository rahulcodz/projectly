export type FieldErrors = Record<string, string>;

export type ApiError = {
  error?: string;
  fieldErrors?: FieldErrors;
};

export async function parseApiError(res: Response): Promise<{
  message: string;
  fieldErrors: FieldErrors;
}> {
  let data: ApiError = {};
  try {
    data = (await res.json()) as ApiError;
  } catch {
    return { message: res.statusText || "Request failed", fieldErrors: {} };
  }
  return {
    message: data.error || "Request failed",
    fieldErrors: data.fieldErrors ?? {},
  };
}

export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new Error(
      `Server returned ${res.status} ${res.statusText || "error"}`
    );
  }
}
