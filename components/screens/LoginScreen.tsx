import React, { useEffect, useState } from 'react';
import { Brain, UserCircle, Mail, Briefcase } from 'lucide-react';
import { Button, Card, InputField } from '../ui/core';
import type { CandidateProfile, AccessType } from '@/lib/types';

export const LoginScreen = ({
  onSubmit,
  onResume,
  canResume,
  initialData,
  notice,
}: {
  onSubmit: (data: Omit<CandidateProfile, 'acceptedTerms' | 'acceptedDataPolicy'>) => void;
  onResume: () => void;
  canResume: boolean;
  initialData?: Partial<Pick<CandidateProfile, 'name' | 'email' | 'role' | 'accessType'>>;
  notice?: string | null;
}) => {
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    role: string;
    accessType: AccessType;
  }>({ name: '', email: '', role: '', accessType: 'candidate' });

  useEffect(() => {
    if (!initialData) return;
    setFormData((current) => ({
      name: initialData.name ?? current.name,
      email: initialData.email ?? current.email,
      role: initialData.role ?? current.role,
      accessType: initialData.accessType ?? current.accessType,
    }));
  }, [initialData]);
  const emailValid = /\S+@\S+\.\S+/.test(formData.email);
  const candidateRoleValid = formData.accessType !== 'candidate' || formData.role.trim().length > 1;
  const canSubmit = Boolean(formData.name.trim()) && emailValid && candidateRoleValid;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" data-testid="login-screen">
      <div className="max-w-5xl w-full grid lg:grid-cols-2 gap-12 items-center animate-fade-in">
        <div className="space-y-6 text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-3 mb-2">
            <Brain className="w-12 h-12 text-cyan-600" />
            <h1 className="text-5xl font-bold text-stone-800 tracking-tight">
              Initium<span className="text-cyan-600">+</span>
            </h1>
          </div>
          <h2 className="text-3xl font-bold text-stone-700 leading-tight">Evaluación de talento basada en datos</h2>
          <p className="text-lg text-stone-500 leading-relaxed font-light">
            Reemplazamos tests tradicionales por datos conductuales y análisis de patrones para decisiones más objetivas.
          </p>

          {canResume && formData.accessType === 'candidate' ? (
            <Card className="text-left p-4 border-cyan-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-stone-700 text-sm">Sesión previa detectada</div>
                  <div className="text-xs text-stone-500">Puedes continuar donde quedaste.</div>
                </div>
                <Button variant="outline" className="py-2 px-3 text-xs" onClick={onResume}>
                  Continuar
                </Button>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl shadow-stone-200/40 border border-white/60">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit) return;
              onSubmit({
                ...formData,
                name: formData.name.trim(),
                email: formData.email.trim(),
                role: formData.role.trim(),
              });
            }}
          >
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-stone-700">Acceso a plataforma</h3>
            </div>

            {notice ? (
              <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm text-cyan-800">
                {notice}
              </div>
            ) : null}

            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">Ingresar como</p>
              <div className="grid grid-cols-2 gap-2 bg-stone-100 rounded-lg p-1 border border-stone-200">
                <button
                  type="button"
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    formData.accessType === 'candidate'
                      ? 'bg-white text-cyan-700 border border-cyan-200 shadow-sm'
                      : 'text-stone-600 hover:bg-white/70'
                  }`}
                  onClick={() => setFormData((prev) => ({ ...prev, accessType: 'candidate' }))}
                >
                  Candidato
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    formData.accessType === 'recruiter'
                      ? 'bg-white text-cyan-700 border border-cyan-200 shadow-sm'
                      : 'text-stone-600 hover:bg-white/70'
                  }`}
                  onClick={() => setFormData((prev) => ({ ...prev, accessType: 'recruiter' }))}
                >
                  Recruiter
                </button>
              </div>
            </div>

            <InputField
              placeholder="Nombre completo"
              value={formData.name}
              onChange={(name) => setFormData((prev) => ({ ...prev, name }))}
              icon={UserCircle}
            />
            <InputField
              placeholder="Correo electrónico"
              type="email"
              value={formData.email}
              onChange={(email) => setFormData((prev) => ({ ...prev, email }))}
              icon={Mail}
            />
            <InputField
              placeholder={formData.accessType === 'candidate' ? 'Rol o puesto objetivo' : 'Área o posición a cubrir'}
              value={formData.role}
              onChange={(role) => setFormData((prev) => ({ ...prev, role }))}
              icon={Briefcase}
            />

            {!emailValid && formData.email ? <p className="text-xs text-red-500">Ingresa un correo válido.</p> : null}
            {!candidateRoleValid && formData.role ? <p className="text-xs text-red-500">Indica el rol objetivo.</p> : null}

            <Button
              type="submit"
              variant="primary"
              className="w-full text-lg py-4 mt-2"
              disabled={!canSubmit}
            >
              Ingresar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
