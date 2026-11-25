type MobileConfirmPasswordProps = {
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
};

export function MobileConfirmPassword({
  value,
  visible,
  onChange,
  onToggle,
}: MobileConfirmPasswordProps) {
  return (
    <label className="mobile-confirm-password">
      <span className="sr-only">Confirmar senha</span>

      <span className="auth-password-field">
        <input
          type={visible ? "text" : "password"}
          minLength={8}
          autoComplete="new-password"
          aria-label="Confirmar senha"
          placeholder="Confirmar senha"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />

        <button
          type="button"
          className="auth-password-toggle"
          aria-label={visible ? "Ocultar confirmação" : "Mostrar confirmação"}
          aria-pressed={visible}
          onClick={onToggle}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
            <circle cx="12" cy="12" r="2.7" />
            {!visible && <path d="m4 4 16 16" />}
          </svg>
        </button>
      </span>
    </label>
  );
}