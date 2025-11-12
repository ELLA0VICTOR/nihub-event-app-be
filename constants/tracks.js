/**
 * Predefined track options for events
 */
exports.TRACKS = [
    {
      id: 'web-app',
      name: 'Web and App',
      abbreviation: 'WA',
      description: 'Web and mobile application development',
    },
    {
      id: 'networking',
      name: 'Networking',
      abbreviation: 'NET',
      description: 'Computer networking and infrastructure',
    },
    {
      id: 'cloud',
      name: 'Cloud Computing',
      abbreviation: 'CLOUD',
      description: 'Cloud computing and services',
    },
    {
      id: 'pcb',
      name: 'PCB',
      abbreviation: 'PCB',
      description: 'Printed Circuit Board design and development',
    },
  ];
  
  /**
   * Get track by name or abbreviation
   */
  exports.getTrack = (identifier) => {
    return this.TRACKS.find(
      t =>
        t.name === identifier ||
        t.abbreviation === identifier ||
        t.id === identifier
    );
  };
  
  /**
   * Validate track name
   */
  exports.isValidTrack = (trackName) => {
    return this.TRACKS.some(t => t.name === trackName || t.abbreviation === trackName);
  };