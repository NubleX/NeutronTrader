// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

function Spinner({ message, small = false }) {
  return (
    <div className={small ? 'loading-spinner small' : 'loading-spinner'}>
      <div className="spinner" />
      {message ? <p className="loading-message">{message}</p> : null}
    </div>
  );
}

export default Spinner;
