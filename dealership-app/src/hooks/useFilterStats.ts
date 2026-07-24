import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../lib/api';

interface FilterStats {
  condition: Record<string, number>;
  transmission: Record<string, number>;
  fuelType: Record<string, number>;
  year: Record<string, number>;
  priceRanges: {
    under_5m: number;
    '5m_15m': number;
    '15m_30m': number;
    '30m_50m': number;
    above_50m: number;
  };
  yearRanges: {
    '2020_and_newer': number;
    '2015_2019': number;
    '2010_2014': number;
    '2005_2009': number;
    before_2005: number;
  };
  district: Record<string, number>;
}

const defaultStats: FilterStats = {
  condition: {},
  transmission: {},
  fuelType: {},
  year: {},
  priceRanges: {
    under_5m: 0,
    '5m_15m': 0,
    '15m_30m': 0,
    '30m_50m': 0,
    above_50m: 0
  },
  yearRanges: {
    '2020_and_newer': 0,
    '2015_2019': 0,
    '2010_2014': 0,
    '2005_2009': 0,
    before_2005: 0
  },
  district: {}
};

export const useFilterStats = () => {
  const [stats, setStats] = useState<FilterStats>(defaultStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/filter-stats`);
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch filter stats:', error);
        // Keep default stats if fetch fails
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading };
};
