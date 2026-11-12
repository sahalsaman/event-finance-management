import { SubmitButton } from '@/components/SubmitButton';

type ManagerFormFieldsProps = {
  name?: string;
  email?: string;
  active?: boolean;
  edit?: boolean;
};

export function ManagerFormFields({ name = '', email = '', active = true, edit = false }: ManagerFormFieldsProps) {
  return <>
    <div className="field"><label>Full name</label><input name="name" required maxLength={120} defaultValue={name} /></div>
    <div className="field"><label>Email</label><input name="email" type="email" required maxLength={254} defaultValue={email} /></div>
    {edit && <div className="field"><label>Account status</label><select name="active" required defaultValue={active ? 'true' : 'false'}><option value="true">Active</option><option value="false">Inactive</option></select></div>}
    <div className="field"><label>{edit ? 'New password (optional, at least 6 characters)' : 'Password (at least 6 characters)'}</label><input name="password" type="password" minLength={6} required={!edit} autoComplete="new-password" /></div>
    <SubmitButton style={{ width: '100%' }} pendingText={edit ? 'Saving...' : 'Creating...'}>{edit ? 'Save Changes' : 'Create Manager'}</SubmitButton>
  </>;
}
