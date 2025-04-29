import axios from 'axios'

export async function geocodeAddress(address) {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: address,
        format: 'json',
        limit: 1,
      },
      headers: {
        'User-Agent': 'YourAppName/1.0 (your@email.com)', // Required
      },
    });

    if (response.data.length === 0) {
      throw new Error('No coordinates found for this address');
    }

    const { lat, lon } = response.data[0];
    return {
      type: 'Point',
      coordinates: [parseFloat(lon), parseFloat(lat)],
    };
  } catch (error) {
    console.error('Geocoding error:', error.message);
    throw error;
  }
}
