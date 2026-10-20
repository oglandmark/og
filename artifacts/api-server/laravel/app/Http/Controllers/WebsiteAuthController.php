<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class WebsiteAuthController extends Controller
{
    public function login(Request $request): View
    {
        $role = strtolower((string) $request->query('role', 'user')) === 'admin' ? 'admin' : 'user';

        return view('auth.login', [
            'intendedRole' => $role,
            'adminOtpSent' => (bool) $request->session()->get('admin_otp_email'),
        ]);
    }

    public function register(Request $request): View
    {
        return view('auth.register', ['intendedRole' => 'user']);
    }

    public function forgotAdminPassword(): View
    {
        return view('auth.forgot-password');
    }

    public function sendAdminPasswordReset(Request $request): RedirectResponse
    {
        $validated = $request->validate(['email' => ['required', 'email', 'max:320']]);
        $result = $this->api('auth/admin-forgot-password', 'POST', $validated);

        if ($result['status'] < 200 || $result['status'] >= 300) {
            return back()->withInput()->withErrors([
                'reset' => $result['data']['error'] ?? 'Password reset is temporarily unavailable. Please try again.',
            ]);
        }

        return redirect()->route('admin.password.reset', ['email' => $validated['email']])
            ->with('success', 'If an administrator account matches that email, a reset code will be sent. Check your inbox and spam folder. If it does not arrive, contact support.');
    }

    public function resetAdminPassword(Request $request): View
    {
        return view('auth.reset-password', [
            'email' => (string) $request->query('email', ''),
        ]);
    }

    public function updateAdminPassword(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:320'],
            'code' => ['required', 'digits:6'],
            'newPassword' => ['required', 'string', 'min:8', 'max:256', 'confirmed'],
        ]);

        $result = $this->api('auth/admin-reset-password', 'POST', [
            'email' => strtolower(trim($validated['email'])),
            'code' => $validated['code'],
            'newPassword' => $validated['newPassword'],
        ]);

        if ($result['status'] < 200 || $result['status'] >= 300) {
            return back()->withInput($request->except('newPassword', 'newPassword_confirmation'))
                ->withErrors(['reset' => $result['data']['error'] ?? 'Password could not be reset. Request a new code and try again.']);
        }

        return redirect()->route('auth.login', ['role' => 'admin'])
            ->with('success', 'Your password has been reset. Sign in with your new password.');
    }

    public function authenticate(Request $request): RedirectResponse
    {
        if (!$request->filled('identifier') && $request->filled('email')) {
            $request->merge(['identifier' => $request->input('email')]);
        }

        $role = strtolower((string) $request->input('role', 'user')) === 'admin' ? 'admin' : 'user';

        $rules = $request->filled('otp')
            ? ['identifier' => ['required', 'email', 'max:320'], 'otp' => ['required', 'digits:6']]
            : ['identifier' => ['required', 'string', 'max:320'], 'password' => ['required', 'string', 'max:256']];
        $validated = $request->validate($rules);

        if ($role === 'admin') {
            if ($request->filled('otp')) {
                $email = strtolower(trim((string) $request->session()->get('admin_otp_email', $validated['identifier'])));
                $result = $this->api('auth/admin-otp', 'POST', [
                    'email' => $email,
                    'otp' => $validated['otp'],
                ]);
                if ($result['status'] < 200 || $result['status'] >= 300 || empty($result['data']['token'])) {
                    return back()->withInput($request->except('otp', 'password'))
                        ->withErrors(['login' => $result['data']['error'] ?? 'Admin verification could not be completed.']);
                }

                $request->session()->forget('admin_otp_email');
                return $this->startSession($request, $result['data']);
            }

            $result = $this->api('auth/admin-verify', 'POST', [
                'email' => strtolower(trim((string) $validated['identifier'])),
                'password' => $validated['password'],
            ]);
            if ($result['status'] < 200 || $result['status'] >= 300) {
                return back()->withInput($request->except('password'))
                    ->withErrors(['login' => $result['data']['error'] ?? 'Admin sign-in could not be completed.']);
            }

            $request->session()->put('admin_otp_email', strtolower(trim((string) $validated['identifier'])));
            return redirect()->route('auth.login', ['role' => 'admin'])
                ->with('success', 'A verification code has been sent to your admin email.');
        }

        $result = $this->api('auth/login', 'POST', [
            'identifier' => $validated['identifier'],
            'password' => $validated['password'],
        ]);
        if ($result['status'] < 200 || $result['status'] >= 300 || empty($result['data']['token'])) {
            return back()->withInput($request->except('password'))
                ->withErrors(['login' => $result['data']['error'] ?? 'Sign-in could not be completed.']);
        }

        if (strtolower((string) ($result['data']['user']['role'] ?? '')) === 'admin') {
            $this->api('auth/logout', 'POST', [], (string) $result['data']['token']);
            return back()->withInput($request->except('password'))
                ->withErrors(['login' => 'Use the administrator sign-in option to verify your account by email.']);
        }

        return $this->startSession($request, $result['data']);
    }

    public function storeRegistration(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:320'],
            'phone' => ['required', 'string', 'max:32'],
            'password' => ['required', 'string', 'min:8', 'max:256', 'confirmed'],
            'city' => ['nullable', 'string', 'max:120'],
        ]);

        $result = $this->api('auth/register', 'POST', [...$validated, 'role' => 'User']);
        if ($result['status'] < 200 || $result['status'] >= 300) {
            return back()->withInput($request->except('password', 'password_confirmation'))
                ->withErrors(['register' => $result['data']['error'] ?? 'Your account could not be created.']);
        }

        if (empty($result['data']['token'])) {
            return back()->withErrors(['register' => 'Your account was created, but sign-in could not be started. Please sign in.']);
        }

        return $this->startSession($request, $result['data']);
    }

    public function logout(Request $request): RedirectResponse
    {
        $token = (string) $request->session()->get('api_token', '');
        if ($token !== '') {
            $this->api('auth/logout', 'POST', [], $token);
        }

        $request->session()->forget(['api_token', 'portal_user', 'admin_otp_email']);
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('home')->with('success', 'You have signed out.');
    }

    private function startSession(Request $request, array $auth): RedirectResponse
    {
        $user = $auth['user'] ?? [];
        $role = strtolower((string) ($user['role'] ?? 'user'));
        $permissions = array_map('strtolower', (array) ($user['permissions'] ?? []));
        $role = in_array('admin', $permissions, true) || $role === 'admin' ? 'admin'
            : (in_array('agent', $permissions, true) || $role === 'agent' ? 'agent'
                : (in_array('developer', $permissions, true) || $role === 'developer' ? 'seller' : 'user'));

        $request->session()->regenerate();
        $request->session()->put('api_token', (string) $auth['token']);
        $request->session()->put('portal_user', $user);

        return redirect()->route('portal.page', ['role' => $role, 'page' => 'dashboard'])
            ->with('success', 'Welcome back.');
    }

    private function api(string $path, string $method, array $payload = [], ?string $token = null): array
    {
        $request = Request::create('/api/' . $path, $method, $payload);
        if ($token !== null && $token !== '') {
            $request->headers->set('Authorization', 'Bearer ' . $token);
        }

        try {
            $response = app(ApiController::class)->handle($request, $path);
        } catch (\Throwable $exception) {
            report($exception);
            return ['status' => 503, 'data' => ['error' => 'The sign-in service is temporarily unavailable.']];
        }

        if (!$response instanceof JsonResponse) {
            return ['status' => 500, 'data' => ['error' => 'The sign-in service returned an unexpected response.']];
        }

        return ['status' => $response->getStatusCode(), 'data' => $response->getData(true) ?? []];
    }
}