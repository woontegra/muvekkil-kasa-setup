type Props = {
  title: string;
  description?: string;
};

export function PageHeader({ title, description }: Props) {
  return (
    <header className="pm-page-header">
      <h1 className="pm-page-header-title">{title}</h1>
      {description ? <p className="pm-page-header-desc">{description}</p> : null}
    </header>
  );
}
