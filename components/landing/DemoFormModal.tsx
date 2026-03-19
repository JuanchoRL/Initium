import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";
import { LandingButton } from "./LandingButton";

const demoSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  email: z.string().trim().email("Ingresa un email válido").max(255),
  company: z.string().trim().min(2, "El nombre de la empresa es requerido").max(100),
  role: z.string().min(1, "Selecciona tu rol"),
  employees: z.string().min(1, "Selecciona el tamaño de empresa"),
  message: z.string().trim().max(1000).optional(),
});

type FormData = z.infer<typeof demoSchema>;
type FormErrors = Partial<Record<keyof FormData, string>>;

const DemoFormModal = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const [form, setForm] = useState<Partial<FormData>>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = demoSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.errors.forEach((err) => {
        const key = err.path[0] as keyof FormData;
        if (!fieldErrors[key]) fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSubmitting(false);
    setSuccess(true);
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setTimeout(() => { setForm({}); setErrors({}); setSuccess(false); }, 300);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border/50 backdrop-blur-xl">
        {success ? (
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-xl font-bold text-foreground">¡Solicitud enviada!</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Nos pondremos en contacto contigo en las próximas 24 horas.
            </DialogDescription>
            <LandingButton variant="hero" onClick={() => handleClose(false)} className="mt-2">Cerrar</LandingButton>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-foreground">Solicitar demo</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Completa el formulario y te contactaremos para agendar una demostración personalizada.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <Field label="Nombre completo" error={errors.name}>
                <Input placeholder="Tu nombre" value={form.name || ""} onChange={(e) => update("name", e.target.value)} className="bg-background/50 border-border/50 focus-visible:ring-primary/30" />
              </Field>
              <Field label="Email corporativo" error={errors.email}>
                <Input type="email" placeholder="tu@empresa.com" value={form.email || ""} onChange={(e) => update("email", e.target.value)} className="bg-background/50 border-border/50 focus-visible:ring-primary/30" />
              </Field>
              <Field label="Empresa" error={errors.company}>
                <Input placeholder="Nombre de tu empresa" value={form.company || ""} onChange={(e) => update("company", e.target.value)} className="bg-background/50 border-border/50 focus-visible:ring-primary/30" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tu rol" error={errors.role}>
                  <Select value={form.role || ""} onValueChange={(v) => update("role", v)}>
                    <SelectTrigger className="bg-background/50 border-border/50"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {["RRHH / People", "Talent Acquisition", "Hiring Manager", "C-Level", "Otro"].map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Empleados" error={errors.employees}>
                  <Select value={form.employees || ""} onValueChange={(v) => update("employees", v)}>
                    <SelectTrigger className="bg-background/50 border-border/50"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {["1-50", "51-200", "201-500", "500+"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Mensaje (opcional)" error={errors.message}>
                <Textarea placeholder="¿Qué te gustaría evaluar?" value={form.message || ""} onChange={(e) => update("message", e.target.value)} rows={3} className="bg-background/50 border-border/50 focus-visible:ring-primary/30 resize-none" />
              </Field>
              <LandingButton type="submit" variant="hero" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : "Solicitar demo"}
              </LandingButton>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-sm text-foreground/80">{label}</Label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

export default DemoFormModal;
