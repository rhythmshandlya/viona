import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { isAssetSystemV2 } from '@/lib/feature-flags';

const pushSpy = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: pushSpy })),
}));
vi.mock('@/lib/feature-flags', () => ({ isAssetSystemV2: vi.fn() }));
vi.mock('@/lib/api/assets', () => ({ AssetsApi: class {} }));
vi.mock('@/lib/assets/upload-client', () => ({ uploadAndRegister: vi.fn() }));
// Mock whatever api method you use for createProject
vi.mock('@/lib/api', () => ({
  api: {
    createProject: vi.fn(),
    sendAgentMessage: vi.fn(),
  },
}));

import NewProjectPage from './page';

describe('NewProjectPage', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    (useRouter as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ push: pushSpy });
    (isAssetSystemV2 as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  it('renders drop zone + prompt textarea + Create button', () => {
    render(<NewProjectPage />);
    expect(screen.getByRole('textbox', { name: /prompt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('disables Create button when no files or prompt', () => {
    render(<NewProjectPage />);
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('redirects to /projects when ASSET_SYSTEM_V2 is off', () => {
    (isAssetSystemV2 as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    render(<NewProjectPage />);
    expect(pushSpy).toHaveBeenCalledWith('/projects');
  });

  it('renders form when ASSET_SYSTEM_V2 is on', () => {
    (isAssetSystemV2 as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    render(<NewProjectPage />);
    expect(screen.getByRole('textbox', { name: /prompt/i })).toBeInTheDocument();
  });
});
