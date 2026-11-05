/**
 * Sample Data Provider - RandoFinder
 * Les Randonneurs Sanaryens - JLD Apps 2026
 * Pure Real Data Architecture - No artificial dummy tracks or bounding boxes
 */

class SampleData {
  static getSampleHikes() {
    // Zero artificial dummy mockups - only authentic cloud & GPX hikes are loaded
    return [];
  }
}

window.SampleData = SampleData;