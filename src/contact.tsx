import { X,  ArrowRight } from 'lucide-react';

const ContactModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      {/* CONTAINER */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="
          bg-[#e9e4db]
          w-full
          h-full
          md:h-auto
          md:max-w-md
          mx-0 md:mx-4
          rounded-none md:rounded-[2rem]
          p-6 md:p-8
          relative
          text-center
          shadow-2xl
          flex flex-col justify-center md:block
        "
      >
        {/* CLOSE */}
        <button
          onClick={onClose}
          className="
            absolute top-5 right-5
            w-12 h-12 md:w-9 md:h-9
            rounded-full
            border border-[#595d48]/20
            flex items-center justify-center
          "
        >
          <X size={20} className="md:w-4 md:h-4" />
        </button>

        {/* LOGO */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-4">
            <img src="/logo.png" alt="Vekio Logo" className="w-14 h-14 md:w-12 md:h-12" />
          </div>

          <h2 className="text-xl font-semibold">Vekio Engenharia</h2>
          <p className="text-sm opacity-70 mt-1">
            Construção civil e reformas de alto padrão.
          </p>
        </div>

        {/* BOTÕES */}
        <div className="flex flex-col gap-4 mt-6 -">
          {/* FLORIPA */}
          <a
            href="https://api.whatsapp.com/send/?phone=5514998450837&text&type=phone_number&app_absent=0"
            target="_blank"
            className="
              flex items-center justify-between
              px-6 py-5
              border-2 border-black
              bg-[#ffffff]
              hover:bg-[#05173b] hover:text-white
              transition-all
              rounded-md
            "
          >
            <span className="text-lg font-medium">WhatsApp</span>
            <ArrowRight />
          </a>

         
        </div>
      </div>
    </div>
  );
};

export default ContactModal;