export default function Stepper({ label, value, onChange, step = 1, unit = "", min = 0, max = 999 }) {
  // Aseguramos que no baje del mínimo ni pase del máximo al usar botones
  const handleDecrease = () => onChange(Math.max(min, Number(value) - step));
  const handleIncrease = () => onChange(Math.min(max, Number(value) + step));

  // Manejar cuando escribes a mano
  const handleInputChange = (e) => {
    // Permitir borrar todo temporalmente mientras escribes
    if (e.target.value === '') {
      onChange('');
      return;
    }
    const val = Number(e.target.value);
    if (!isNaN(val)) onChange(val);
  };

  // Al quitar el foco (cerrar teclado), validamos que esté dentro de los límites
  const handleBlur = () => {
    if (value === '' || isNaN(value)) {
      onChange(min);
    } else {
      onChange(Math.max(min, Math.min(max, Number(value))));
    }
  };

  return (
    <div className="flex items-center justify-between bg-gray-900 p-3 rounded-2xl border border-gray-800 shadow-sm">
      <span className="text-gray-400 font-bold text-lg w-16">{label}</span>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={handleDecrease} 
          className="w-14 h-14 bg-gray-800 text-white rounded-full flex items-center justify-center text-3xl font-light active:bg-gray-700 active:scale-90 transition-all select-none touch-manipulation"
        >
          -
        </button>
        
        <div className="w-24 relative flex items-center justify-center">
          <input
            type="number"
            inputMode={step % 1 !== 0 ? "decimal" : "numeric"}
            value={value}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className="w-full bg-transparent text-center text-3xl font-black text-white focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none m-0"
          />
          {unit && <span className="text-sm text-gray-500 absolute -right-2">{unit}</span>}
        </div>
        
        <button 
          onClick={handleIncrease} 
          className="w-14 h-14 bg-green-600 text-white rounded-full flex items-center justify-center text-3xl font-light active:bg-green-500 active:scale-90 transition-all select-none touch-manipulation shadow-[0_0_10px_rgba(22,163,74,0.3)]"
        >
          +
        </button>
      </div>
    </div>
  );
}