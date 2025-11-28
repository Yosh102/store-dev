export async function createZendeskTicket(
  name: string, 
  email: string, 
  message: string,
  captchaToken?: string
) {
  try {
    const payload: any = { name, email, message };
    
    if (captchaToken !== undefined) {
      payload.captchaToken = captchaToken;
    }
    
    const response = await fetch('/api/support/create-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'お問い合わせの送信に失敗しました。');
    }

    return data;
  } catch (error) {
    throw error;
  }
}