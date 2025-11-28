import ContactForm from '@/components/contact/ContactForm';

export default function ContactClient() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-[480px] mx-auto">
        <div className="space-y-6">
          <div className="text-left space-y-2">
            <h1 className="text-lg font-bold">お問い合わせ</h1>
            <p className="text-lg text-gray-600">
              返信が必要なお問い合わせに関しては、3営業日以内に担当者よりメールにてご案内させていただきます。
            </p>
          </div>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}

