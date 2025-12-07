
import { GoogleGenAI, Type } from "@google/genai";
import { CompanyProfile, PotentialClient, OutreachEmail, PortfolioContent, ClientSearchResult, EmailMessage } from '../types';

export async function findPotentialClients(profile: CompanyProfile, existingClients: PotentialClient[]): Promise<ClientSearchResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const existingCompanyNames = existingClients.map(c => c.companyName).join(', ');

  const regions = profile.location.regions.length > 0 ? profile.location.regions.join(', ') : '';
  const cities = profile.location.cities.length > 0 ? profile.location.cities.join(', ') : '';
  
  const locationParts = [];
  if (cities) locationParts.push(`Cities/Districts: ${cities}`);
  if (regions) locationParts.push(`States/Regions: ${regions}`);
  if (profile.location.country) locationParts.push(`Country: ${profile.location.country}`);

  const locationString = locationParts.join(' | ') || "Global/United States";
  
  const industryString = profile.targetIndustries && profile.targetIndustries.length > 0 
    ? `Priority Industries: ${profile.targetIndustries.join(', ')}` 
    : "Industries: Any relevant sector fitting the company description.";

  const prompt = `
    You are an expert B2B lead generation assistant.
    Based on the following company profile, generate a list of 5 potential client companies located in **${locationString}** that would be a great fit for their services.
    
    My Company Profile:
    - Name: ${profile.companyName || 'Not specified'}
    - Description: ${profile.description}
    - Target Location: ${locationString}
    - ${industryString}

    **CRITICAL INSTRUCTION**: 
    If you truly believe there are NO suitable companies in the specific requested location (e.g., searching for tech giants in a small rural village), return an empty "clients" list and provide 3 "suggestedLocations" (cities or regions) where this business would have better luck.

    If companies are found, "suggestedLocations" should be empty.

    For each potential client, provide:
    1. Company Name
    2. A Specific Contact Person Name (e.g., Marketing Director, CEO).
    3. A Professional Contact Email (e.g., firstname.lastname@company.com).
    4. A brief description.
    5. Their Industry.

    IMPORTANT: Do not suggest: ${existingCompanyNames || 'None'}.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
              clients: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      companyName: { type: Type.STRING },
                      contactName: { type: Type.STRING },
                      contactEmail: { type: Type.STRING },
                      description: { type: Type.STRING },
                      industry: { type: Type.STRING },
                    },
                    required: ["companyName", "contactName", "contactEmail", "description", "industry"],
                  }
              },
              suggestedLocations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
              }
          },
          required: ["clients", "suggestedLocations"]
        },
      },
    });

    let jsonText = response.text.trim();
    jsonText = jsonText.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();

    const result = JSON.parse(jsonText);
    
    const processedClients = result.clients.map((client: Omit<PotentialClient, 'status' | 'id'>) => ({
      ...client,
      id: Math.random().toString(36).substring(2, 11),
      status: 'Generated',
    })) as PotentialClient[];

    return {
        clients: processedClients,
        suggestedLocations: result.suggestedLocations || [],
        found: processedClients.length > 0
    };

  } catch (error) {
    console.error("Error finding potential clients:", error);
    throw new Error("Failed to generate potential clients. Please try again.");
  }
}

export async function generateOutreachEmail(profile: CompanyProfile, client: PotentialClient): Promise<OutreachEmail> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
    You are a senior B2B sales copywriter. Write a customized outreach email from "${profile.companyName || 'The Team'}" (Description: ${profile.description}) to "${client.contactName}" at "${client.companyName}".
    
    Recipient Description: "${client.description}".

    Guidelines:
    - Tone: Human, professional, slightly casual.
    - Subject: Catchy and relevant.
    - Hook: Mention specifically that you have attached a "Customized Marketing Portfolio PDF".
    - Length: Max 150 words.
    
    Return JSON with "subject" and "body".
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.OBJECT,
              properties: {
                  subject: { type: Type.STRING },
                  body: { type: Type.STRING },
              },
              required: ["subject", "body"],
          }
      }
    });
    
    let jsonText = response.text.trim();
    jsonText = jsonText.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
    
    return JSON.parse(jsonText) as OutreachEmail;
  } catch (error) {
      console.error("Error generating outreach email:", error);
      throw new Error("Failed to generate the outreach email.");
  }
}

export async function createPortfolioContent(profile: CompanyProfile, client: PotentialClient): Promise<PortfolioContent> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
    Create text content for a one-page marketing portfolio proposal.
    Sender: "${profile.companyName || 'Our Agency'}" - ${profile.description}.
    Client: "${client.companyName}" (${client.industry}).
    
    Include:
    1. Title
    2. Introduction
    3. 3-4 Services
    4. Call to Action
    5. Design Theme (Palette & Font)
    
    Return as JSON.
  `;
  
  try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    introduction: { type: Type.STRING },
                    services: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                description: { type: Type.STRING }
                            },
                            required: ["name", "description"]
                        }
                    },
                    callToAction: { type: Type.STRING },
                    designTheme: {
                        type: Type.OBJECT,
                        properties: {
                            palette: { type: Type.STRING },
                            fontStyle: { type: Type.STRING }
                        },
                        required: ["palette", "fontStyle"]
                    }
                },
                required: ["title", "introduction", "services", "callToAction", "designTheme"]
            }
        }
      });
      
      let jsonText = response.text.trim();
      jsonText = jsonText.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();

      return JSON.parse(jsonText) as PortfolioContent;
  } catch (error) {
      console.error("Error creating portfolio content:", error);
      throw new Error("Failed to create portfolio content.");
  }
}

export async function generateBusinessStrategy(profile: CompanyProfile): Promise<{ tips: { title: string, content: string }[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
        You are a senior business strategist. Based on this company profile, provide 3 specific, actionable tips to grow their business.
        
        Company Name: ${profile.companyName || 'N/A'}
        Description: ${profile.description}
        Target Audience: ${profile.targetIndustries.join(', ')} in ${profile.location.country}.

        Return JSON with an array of tips.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tips: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    content: { type: Type.STRING }
                                },
                                required: ["title", "content"]
                            }
                        }
                    },
                    required: ["tips"]
                }
            }
        });

        let jsonText = response.text.trim();
        jsonText = jsonText.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error generating strategy:", error);
        return { tips: [{ title: "Error", content: "Could not generate strategy at this time." }] };
    }
}
