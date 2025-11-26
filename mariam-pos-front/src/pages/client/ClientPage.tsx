import React, { useState, useEffect } from 'react';
import '../../styles/pages/client.css';
import Header from '../../components/Header';
import type {Client} from '../../types/index'
import { getClients,createClient } from "../../api/clients";
import Card from '../../components/Card';
import Button from '../../components/Button';
import ClientModal from './ClientModal';

interface ClientPageProps {
  onBack: () => void;
}
 
const ClientPage: React.FC<ClientPageProps> = ({ onBack }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 🟢 Llamada al API cuando el hook se monta
    useEffect(() => {
      fetchClients();
    }, []);
  const fetchClients = async () => {
        try {
           const data = await getClients();
          setClients(data);
        } catch (err) {
          console.error(err);
         } finally {
           console.log('Finally')
        }
  };

  const handleAddNew = () => {
    setShowAddForm(()=> true)
  };

  const handleCloseForm = () => {
    setShowAddForm(()=> false);
  }

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async (client:Omit<Client, "id">) => {
    await createClient(client);
    fetchClients();
  } 
  return (
    <div className="app-client">
      <div className="client-container">
        <Header
          title="Catálogo de Clientes"
          onBack={onBack}
          backText="← Volver"
          className="catalog-header"
        />
        <div className="client-content">
           {/* Barra de búsqueda */}
          <Card className="search-card">
            <div className="search-section">
              <div className="search-group">
                <label htmlFor="search">Buscar Cliente:</label>
                <input
                  type="text"
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre ..."
                  className="search-input"
                />
              </div>
              <Button
                variant="success"
                onClick={handleAddNew}
                className="add-category-btn"
              >
                ➕ Nuevo Cliente
              </Button>
            </div>
          </Card>
            {/* Tabla de clientes */}
            <table className="client-table">
              <thead>
                <tr>
                  <th>*id</th>
                  <th>Nombre</th>
                  <th>Alias</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => (
                  <tr key={client.id}>
                    <td>{client.id}</td>
                    <td>{client.name}</td>
                    <td>{client.alias || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
         {/* Modal para agregar/editar */}
         <ClientModal 
            isOpen={showAddForm}           
            onClose={handleCloseForm}
            onSave={handleSave}
          />
      </div>
    </div>
  );
};

export default ClientPage;
