
'use server';

import {suggestWipeMethod, type SuggestWipeMethodInput} from '@/ai/flows/suggest-wipe-method';
import { generateBlastReport, type BomberGameInput, type BomberGameOutput } from '@/ai/flows/generate-blast-report';
import {z} from 'zod';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';

export async function suggestWipeMethodAction(prevState: any, formData: FormData) {
  const schema = z.object({
    dataType: z.string(),
    securityLevel: z.string(),
  });

  const validatedFields = schema.safeParse({
    dataType: formData.get('dataType'),
    securityLevel: formData.get('securityLevel'),
  });

  if (!validatedFields.success) {
    return {
      error: 'Invalid input',
    };
  }

  try {
    const result = await suggestWipeMethod(validatedFields.data as SuggestWipeMethodInput);
    return result;
  } catch (error) {
    console.error(error);
    return {
      error: 'An error occurred while getting the suggestion.',
    };
  }
}

export async function generateBlastReportAction(input: BomberGameInput): Promise<{ status: 'success', report: BomberGameOutput } | { status: 'error', error: string }> {
  try {
    const result = await generateBlastReport(input);
    return { status: 'success' as const, report: result };
  } catch (error) {
    console.error(error);
    return {
      status: 'error' as const,
      error: 'An error occurred while generating the blast report.',
    };
  }
}


export async function getMasterUserDetails(username: string) {
    if (username !== 'Madhan') {
        return { status: 'not_master' };
    }
    try {
        const response = await fetch('http://localhost:9574/getLoginDetails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
        });

        if (!response.ok) {
            // The service might be down or returned an error
            return { status: 'error', message: 'Could not connect to the user details service.' };
        }

        const result = await response.json();
        return result; // Expected to be { status: 'found' | 'not_found' | 'error', data?: {...}, message?: '...' }

    } catch (error) {
        console.error('Failed to connect to getLoginDetails endpoint:', error);
        return { status: 'error', message: 'Could not connect to the user details service.' };
    }
}


export async function login(prevState: any, formData: FormData) {
  const schema = z.object({
    username: z.string(),
    password: z.string(),
    companyName: z.string().optional(),
    position: z.string().optional(),
    address: z.string().optional(),
    personalInfo: z.string().optional(),
  });
  const data = schema.parse(Object.fromEntries(formData));

  let role = '';
  if (data.username === 'Madhan' && data.password === 'iamironman') {
    role = 'master';

    // Call the external Flask endpoint to store master user details
    try {
      const response = await fetch('http://localhost:9574/loginStorage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: data.username,
          companyName: data.companyName,
          position: data.position,
          address: data.address,
          personalInfo: data.personalInfo,
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ message: 'Failed to store user details. Please check the storage service.' }));
        return {
            error: errorResult.message || 'An unknown error occurred with the storage service.'
        };
      }

      const result = await response.json();
      if (result.status !== 'success') {
          return { error: result.message || 'Storage service returned an error.' };
      }

    } catch (error) {
        console.error('Failed to connect to loginStorage endpoint:', error);
        return { error: 'Could not connect to the user information storage service. Please ensure it is running.' };
    }


  } else if (data.username === 'Worker' && data.password === 'iambenten') {
    role = 'worker';
  }

  if (role) {
    cookies().set('session', JSON.stringify({username: data.username, role}), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    if (role === 'master') {
      redirect('/master/dashboard');
    } else {
      redirect('/worker/dashboard');
    }
  } else {
    return {
      error: 'Invalid username or password.',
    };
  }
}

export async function logout() {
  cookies().delete('session');
  redirect('/login');
}
