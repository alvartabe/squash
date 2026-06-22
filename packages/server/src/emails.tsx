import { Body, Button, Container, Head, Heading, Html, Preview, render, Text } from 'react-email';
import { translate, type Locale, type MessageKey } from '@squash/i18n';

type AuthEmailProps = {
  locale: Locale;
  headingKey: MessageKey;
  bodyKey: MessageKey;
  actionKey: MessageKey;
  url: string;
};

function AuthEmail({ locale, headingKey, bodyKey, actionKey, url }: AuthEmailProps) {
  const heading = translate(locale, headingKey);
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{heading}</Preview>
      <Body
        style={{
          backgroundColor: '#f8fafc',
          fontFamily: 'Arial, sans-serif',
          padding: '32px 12px',
        }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            maxWidth: '520px',
            padding: '32px',
          }}
        >
          <Heading style={{ color: '#166534' }}>{heading}</Heading>
          <Text style={{ color: '#334155', fontSize: '16px', lineHeight: '24px' }}>
            {translate(locale, bodyKey)}
          </Text>
          <Button
            href={url}
            style={{
              backgroundColor: '#166534',
              borderRadius: '8px',
              color: '#ffffff',
              padding: '12px 20px',
            }}
          >
            {translate(locale, actionKey)}
          </Button>
        </Container>
      </Body>
    </Html>
  );
}

export function renderAuthEmail(props: AuthEmailProps) {
  return render(<AuthEmail {...props} />);
}
