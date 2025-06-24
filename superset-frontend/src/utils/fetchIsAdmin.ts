import { SupersetClient } from '@superset-ui/core';

export const fetchIsAdmin = async (setIsAdmin: (val: boolean) => void) => {
  try {
    const response = await SupersetClient.get({
      endpoint: '/api/v1/me/',
      ignoreUnauthorized: true,
    });

    if (response?.json) {
      setIsAdmin(response.json.result.is_admin);
    }
  } catch (error) {
    setIsAdmin(false);
  }
};
