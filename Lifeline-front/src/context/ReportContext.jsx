
import { createContext, useContext, useState } from "react";

const ReportContext = createContext();

export function ReportProvider({ children }) {
  const [selectedReport, setSelectedReport] = useState(null);

  const [journey, setJourney] = useState([]);

  const addToJourney = (report) => {
    if (!report) return;

    setJourney((prev) => {
      // Prevent duplicate reports
      const alreadyExists = prev.some(
        (item) => item.id === report.id
      );

      if (alreadyExists) {
        return prev;
      }

      return [
        ...prev,
        {
          ...report,
          addedToJourney: true,
        },
      ];
    });
  };

  return (
    <ReportContext.Provider
      value={{
        selectedReport,
        setSelectedReport,
        journey,
        addToJourney,
      }}
    >
      {children}
    </ReportContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReport() {
  return useContext(ReportContext);
}
